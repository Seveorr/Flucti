<?php
/**
 * api.php — servidor de Flucti
 *
 * Acciones:
 *   register → crea una cuenta con correo y contraseña y abre sesión.
 *   login    → comprueba correo y contraseña y abre sesión (cookie httpOnly de 30 días).
 *   sync     → sincroniza las tareas de la cuenta con la base de datos (SQLite).
 *   logout   → cierra la sesión del servidor.
 *
 * Las contraseñas NUNCA se guardan en claro: solo su hash (password_hash, bcrypt).
 * Hay límite de intentos fallidos por correo y por IP para frenar adivinar contraseñas.
 *
 * Requisitos: PHP 8.1 o superior con la extensión pdo_sqlite.
 *
 * La base de datos y las sesiones se guardan en ./data (se crea sola y se protege con
 * .htaccess en Apache). En nginx, o mejor aún en cualquier servidor, cambia DATA_DIR
 * por una carpeta FUERA de la web, por ejemplo '/var/lib/flucti'.
 */
declare(strict_types=1);

const DATA_DIR = __DIR__ . '/data';
const DB_PATH = DATA_DIR . '/flucti.sqlite';
const SESSION_NAME = 'flucti_session';
const SESSION_DAYS = 30;                 // la sesión se renueva cada vez que se usa
const MAX_ACTIVE_TASKS = 5000;           // tareas pendientes por cuenta
const MAX_CHANGES_PER_SYNC = 500;        // cambios que se aceptan en una sincronización
const MAX_BODY_BYTES = 1048576;          // 1 MB

const MIN_PASSWORD_LENGTH = 8;           // caracteres
const MAX_PASSWORD_BYTES = 72;           // límite de bcrypt: más allá de 72 bytes no se leería
const ATTEMPT_WINDOW = 900;              // 15 min: ventana de intentos fallidos
const MAX_FAILS_PER_EMAIL = 8;           // intentos fallidos por correo en esa ventana
const MAX_FAILS_PER_IP = 20;             // intentos fallidos por IP en esa ventana
const REGISTER_WINDOW = 3600;            // 1 h
const MAX_REGISTERS_PER_IP = 10;         // cuentas nuevas por IP en esa ventana

ini_set('display_errors', '0'); // nunca mostrar errores de PHP: romperían el JSON

/* ==========================================================================
   Respuestas y comprobaciones de la petición
   ========================================================================== */

function respond(int $status, array $body): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $status, string $error): never
{
    respond($status, ['ok' => false, 'error' => $error]);
}

function isHttps(): bool
{
    return !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
}

// Solo se aceptan peticiones hechas desde la propia web (protege contra CSRF).
function requireSameOrigin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
    if ($origin === null) {
        return;
    }
    $host = parse_url($origin, PHP_URL_HOST);
    $port = parse_url($origin, PHP_URL_PORT);
    if (!is_string($host)) {
        fail(403, 'forbidden_origin');
    }
    $originHost = $host . ($port !== null && $port !== false ? ':' . $port : '');
    if (strcasecmp($originHost, (string) ($_SERVER['HTTP_HOST'] ?? '')) !== 0) {
        fail(403, 'forbidden_origin');
    }
}

function requireJsonRequest(): void
{
    if (stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) {
        fail(415, 'unsupported_media_type');
    }
}

function readJsonBody(): array
{
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > MAX_BODY_BYTES) {
        fail(413, 'too_large');
    }
    $raw = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
    if ($raw === false || strlen($raw) > MAX_BODY_BYTES) {
        fail(413, 'too_large');
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        fail(400, 'bad_json');
    }
    return $data;
}

function textLength(string $text): int
{
    return function_exists('mb_strlen') ? mb_strlen($text) : strlen($text);
}

/* ==========================================================================
   Almacenamiento: carpeta de datos, base de datos SQLite y sesiones
   ========================================================================== */

function ensureDataDir(): void
{
    foreach ([DATA_DIR, DATA_DIR . '/sessions'] as $dir) {
        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            fail(500, 'storage_unavailable');
        }
    }
    $htaccess = DATA_DIR . '/.htaccess';
    if (!is_file($htaccess)) {
        @file_put_contents($htaccess, "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    }
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    ensureDataDir();
    $pdo = new PDO('sqlite:' . DB_PATH, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 5000');

    // Cuentas: el correo (en minúsculas) es único; la contraseña solo existe como hash.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS accounts (
            id            TEXT PRIMARY KEY,
            email         TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at    INTEGER NOT NULL,
            last_login    INTEGER NOT NULL
        )'
    );
    // Intentos recientes (fallidos, o de registro) para limitar por correo y por IP.
    $pdo->exec('CREATE TABLE IF NOT EXISTS auth_attempts (bucket TEXT NOT NULL, at INTEGER NOT NULL)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS auth_attempts_by_bucket ON auth_attempts (bucket, at)');
    // Una fila por tarea. Las tareas completadas no se borran: quedan marcadas (deleted = 1)
    // para que los demás dispositivos sepan que hay que quitarlas.
    // "version" aumenta con cada cambio de la cuenta: cada dispositivo pide "lo posterior a su versión".
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS tasks (
            user_sub   TEXT NOT NULL,
            id         TEXT NOT NULL,
            name       TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            deleted    INTEGER NOT NULL DEFAULT 0,
            version    INTEGER NOT NULL,
            PRIMARY KEY (user_sub, id)
        )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS tasks_by_version ON tasks (user_sub, version)');
    return $pdo;
}

function scalar(PDO $pdo, string $sql, array $params): mixed
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchColumn();
}

function cookieOptions(int $lifetime): array
{
    return [
        'lifetime' => $lifetime,
        'path' => '/',
        'secure' => isHttps(),
        'httponly' => true,
        'samesite' => 'Lax',
    ];
}

function startSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    ensureDataDir();
    $lifetime = SESSION_DAYS * 86400;
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string) $lifetime);
    // Carpeta propia: en algunos servidores el sistema borra las sesiones de la carpeta común a los pocos minutos.
    session_save_path(DATA_DIR . '/sessions');
    session_name(SESSION_NAME);
    session_set_cookie_params(cookieOptions($lifetime));
    session_start();
}

// Abre una sesión nueva para la cuenta (con identificador de sesión nuevo).
function openSession(string $accountId): void
{
    startSession();
    session_regenerate_id(true);
    $_SESSION = ['sub' => $accountId];
    session_write_close();
}

// Devuelve el identificador de la cuenta con sesión abierta, o responde 401.
function requireUser(): string
{
    if (!isset($_COOKIE[SESSION_NAME])) {
        fail(401, 'no_session');
    }
    startSession();
    $sub = $_SESSION['sub'] ?? null;
    if (!is_string($sub) || $sub === '') {
        fail(401, 'no_session');
    }
    // Sesión deslizante: cada uso la alarga otros SESSION_DAYS días.
    $options = cookieOptions(SESSION_DAYS * 86400);
    setcookie(SESSION_NAME, session_id(), [
        'expires' => time() + SESSION_DAYS * 86400,
        'path' => $options['path'],
        'secure' => $options['secure'],
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_write_close(); // no bloquea otras peticiones del mismo usuario
    return $sub;
}

/* ==========================================================================
   Límite de intentos
   ========================================================================== */

// Detrás de un proxy inverso REMOTE_ADDR sería la IP del proxy: en ese caso hay que configurarlo.
function clientIp(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

function attemptsIn(PDO $pdo, string $bucket, int $window): int
{
    return (int) scalar($pdo, 'SELECT COUNT(*) FROM auth_attempts WHERE bucket = ? AND at > ?', [$bucket, time() - $window]);
}

function recordAttempt(PDO $pdo, string $bucket): void
{
    $pdo->prepare('INSERT INTO auth_attempts (bucket, at) VALUES (?, ?)')->execute([$bucket, time()]);
    if (random_int(1, 50) === 1) { // limpieza ocasional de intentos antiguos
        $pdo->prepare('DELETE FROM auth_attempts WHERE at < ?')->execute([time() - 86400]);
    }
}

function clearAttempts(PDO $pdo, string $bucket): void
{
    $pdo->prepare('DELETE FROM auth_attempts WHERE bucket = ?')->execute([$bucket]);
}

/* ==========================================================================
   Cuentas: registro e inicio de sesión
   ========================================================================== */

function normalizeEmail(mixed $value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $email = trim($value);
    $email = function_exists('mb_strtolower') ? mb_strtolower($email) : strtolower($email);
    if ($email === '' || strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        return null;
    }
    return $email;
}

function handleRegister(): never
{
    $body = readJsonBody();
    $email = normalizeEmail($body['email'] ?? null);
    $password = $body['password'] ?? null;
    if ($email === null) {
        fail(400, 'invalid_email');
    }
    if (!is_string($password) || textLength($password) < MIN_PASSWORD_LENGTH) {
        fail(400, 'weak_password');
    }
    if (strlen($password) > MAX_PASSWORD_BYTES) {
        fail(400, 'password_too_long');
    }

    $pdo = db();
    $bucket = 'register:' . clientIp();
    if (attemptsIn($pdo, $bucket, REGISTER_WINDOW) >= MAX_REGISTERS_PER_IP) {
        fail(429, 'too_many_attempts');
    }
    recordAttempt($pdo, $bucket); // cada intento de registro cuenta

    if (scalar($pdo, 'SELECT 1 FROM accounts WHERE email = ?', [$email]) !== false) {
        fail(409, 'email_taken');
    }

    $id = bin2hex(random_bytes(16));
    $now = time();
    try {
        $pdo->prepare(
            'INSERT INTO accounts (id, email, password_hash, created_at, last_login) VALUES (?, ?, ?, ?, ?)'
        )->execute([$id, $email, password_hash($password, PASSWORD_DEFAULT), $now, $now]);
    } catch (PDOException $e) {
        if (stripos($e->getMessage(), 'UNIQUE') !== false) { // otro registro con el mismo correo a la vez
            fail(409, 'email_taken');
        }
        throw $e;
    }

    openSession($id);
    respond(200, ['ok' => true, 'user' => ['sub' => $id, 'email' => $email]]);
}

function handleLogin(): never
{
    $body = readJsonBody();
    $email = normalizeEmail($body['email'] ?? null);
    $password = $body['password'] ?? null;
    if ($email === null || !is_string($password) || $password === '') {
        fail(401, 'invalid_credentials'); // mismo mensaje que una contraseña incorrecta
    }

    $pdo = db();
    $ipBucket = 'ip:' . clientIp();
    $emailBucket = 'email:' . hash('sha256', $email);
    if (
        attemptsIn($pdo, $ipBucket, ATTEMPT_WINDOW) >= MAX_FAILS_PER_IP
        || attemptsIn($pdo, $emailBucket, ATTEMPT_WINDOW) >= MAX_FAILS_PER_EMAIL
    ) {
        fail(429, 'too_many_attempts');
    }

    $stmt = $pdo->prepare('SELECT id, password_hash FROM accounts WHERE email = ?');
    $stmt->execute([$email]);
    $account = $stmt->fetch();
    $stmt->closeCursor();

    $valid = $account !== false
        && strlen($password) <= MAX_PASSWORD_BYTES
        && password_verify($password, (string) $account['password_hash']);

    if (!$valid) {
        recordAttempt($pdo, $ipBucket);
        recordAttempt($pdo, $emailBucket);
        fail(401, 'invalid_credentials'); // no dice si falla el correo o la contraseña
    }

    clearAttempts($pdo, $emailBucket);

    // Si el algoritmo de hash por defecto ha mejorado, se actualiza el hash guardado.
    if (password_needs_rehash((string) $account['password_hash'], PASSWORD_DEFAULT)) {
        $pdo->prepare('UPDATE accounts SET password_hash = ? WHERE id = ?')
            ->execute([password_hash($password, PASSWORD_DEFAULT), $account['id']]);
    }
    $pdo->prepare('UPDATE accounts SET last_login = ? WHERE id = ?')->execute([time(), $account['id']]);

    openSession((string) $account['id']);
    respond(200, ['ok' => true, 'user' => ['sub' => (string) $account['id'], 'email' => $email]]);
}

function handleLogout(): never
{
    if (isset($_COOKIE[SESSION_NAME])) {
        startSession();
        $_SESSION = [];
        setcookie(SESSION_NAME, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => isHttps(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_destroy();
    }
    respond(200, ['ok' => true]);
}

/* ==========================================================================
   Sincronización de tareas
   ========================================================================== */

// Valida un cambio recibido del navegador. Devuelve null si no es válido (se ignora ese cambio).
function cleanChange(mixed $change, int $now): ?array
{
    if (!is_array($change)) {
        return null;
    }
    $id = $change['id'] ?? null;
    if (!is_string($id) || preg_match('/^[A-Za-z0-9_-]{8,64}$/', $id) !== 1) {
        return null;
    }
    $deleted = ($change['deleted'] ?? false) === true;

    $name = '';
    if (!$deleted) {
        $raw = $change['name'] ?? null;
        if (!is_string($raw)) {
            return null;
        }
        $name = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $raw);
        if ($name === null) { // texto que no es UTF-8 válido
            return null;
        }
        $name = trim($name);
        if ($name === '' || textLength($name) > 120) {
            return null;
        }
    }

    $created = $change['createdAt'] ?? 0;
    $createdAt = (is_int($created) || is_float($created)) ? (int) $created : 0;
    if ($createdAt <= 0 || $createdAt > ($now + 86400) * 1000) {
        $createdAt = $now * 1000;
    }
    return ['id' => $id, 'name' => $name, 'deleted' => $deleted, 'createdAt' => $createdAt];
}

/**
 * Sincronización: el navegador manda sus cambios pendientes y la versión que conoce ("since");
 * el servidor los aplica y devuelve todo lo que ha cambiado en la cuenta desde esa versión.
 * Reglas: una tarea nueva se añade; una tarea completada se marca como borrada y no vuelve
 * (el nombre de una tarea no se edita, así que no hay conflictos).
 */
function handleSync(): never
{
    $sub = requireUser();
    $body = readJsonBody();

    $changes = $body['changes'] ?? [];
    if (!is_array($changes) || count($changes) > MAX_CHANGES_PER_SYNC) {
        fail(400, 'bad_request');
    }
    $since = $body['since'] ?? 0;
    $since = (is_int($since) && $since > 0) ? $since : 0;

    $pdo = db();
    $now = time();
    $rejected = [];

    $pdo->beginTransaction();
    try {
        $version = (int) scalar($pdo, 'SELECT COALESCE(MAX(version), 0) FROM tasks WHERE user_sub = ?', [$sub]);
        $active = (int) scalar($pdo, 'SELECT COUNT(*) FROM tasks WHERE user_sub = ? AND deleted = 0', [$sub]);
        $find = $pdo->prepare('SELECT deleted FROM tasks WHERE user_sub = ? AND id = ?');
        $insert = $pdo->prepare(
            'INSERT INTO tasks (user_sub, id, name, created_at, deleted, version) VALUES (?, ?, ?, ?, ?, ?)'
        );
        $remove = $pdo->prepare('UPDATE tasks SET deleted = 1, version = ? WHERE user_sub = ? AND id = ?');

        foreach ($changes as $change) {
            $clean = cleanChange($change, $now);
            if ($clean === null) {
                if (is_array($change) && is_string($change['id'] ?? null)) {
                    $rejected[] = $change['id'];
                }
                continue;
            }

            $find->execute([$sub, $clean['id']]);
            $row = $find->fetch();
            $find->closeCursor();

            if ($row === false) {
                if (!$clean['deleted']) {
                    if ($active >= MAX_ACTIVE_TASKS) {
                        $rejected[] = $clean['id'];
                        continue;
                    }
                    $active++;
                }
                $version++;
                $insert->execute([
                    $sub, $clean['id'], $clean['name'], $clean['createdAt'], $clean['deleted'] ? 1 : 0, $version,
                ]);
            } elseif ($clean['deleted'] && (int) $row['deleted'] === 0) {
                $version++;
                $remove->execute([$version, $sub, $clean['id']]);
                $active--;
            }
            // Si ya existe y no es un borrado, se ignora: no se edita ni se "resucita".
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    if ($since > $version) {
        $since = 0; // el navegador conoce una versión que el servidor no tiene: sincronización completa
    }
    $stmt = $pdo->prepare(
        'SELECT id, name, created_at, deleted FROM tasks WHERE user_sub = ? AND version > ? ORDER BY version ASC'
    );
    $stmt->execute([$sub, $since]);
    $out = [];
    foreach ($stmt->fetchAll() as $row) {
        $out[] = [
            'id' => $row['id'],
            'name' => $row['name'],
            'createdAt' => (int) $row['created_at'],
            'deleted' => (int) $row['deleted'] === 1,
        ];
    }

    respond(200, [
        'ok' => true,
        'version' => $version,
        'changes' => $out,
        'rejected' => array_values(array_unique($rejected)),
    ]);
}

/* ==========================================================================
   Entrada
   ========================================================================== */

set_exception_handler(static function (Throwable $e): void {
    error_log('Flucti api.php: ' . $e->getMessage());
    fail(500, 'server_error');
});

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'method_not_allowed');
}
requireSameOrigin();
requireJsonRequest();

switch ($_GET['action'] ?? '') {
    case 'register':
        handleRegister();
    case 'login':
        handleLogin();
    case 'sync':
        handleSync();
    case 'logout':
        handleLogout();
    default:
        fail(404, 'unknown_action');
}