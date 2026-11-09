"use strict";

/* ==========================================================================
   auth.js — cuentas con correo y contraseña

   La app habla con el servidor (api.php), que guarda las cuentas y las contraseñas
   (cifradas con hash, nunca en claro) y abre una sesión con una cookie.
   Aquí solo se envían el correo y la contraseña por HTTPS y se guarda en el dispositivo
   qué cuenta tiene la sesión abierta.

   Con API_URL = "" no hay servidor: no hay cuentas ni sincronización y solo se ofrece
   el modo de desarrollo (tareas guardadas únicamente en este dispositivo).
   ========================================================================== */

// Dirección del servidor. Debe estar en el mismo dominio que la app.
const API_URL = "api.php";

const Auth = (() => {
  const SESSION_KEY = "session:v1";

  // Hace falta un servidor configurado y abrir la app desde http(s) (no como archivo local).
  const canUseServer = () => Boolean(API_URL) && /^https?:$/.test(window.location.protocol);

  /* --- Servidor (api.php): todas las llamadas son POST con JSON y la cookie de sesión --- */
  async function api(action, body) {
    const res = await fetch(`${API_URL}?action=${action}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* la respuesta no era JSON */
    }
    return { status: res.status, ok: res.ok, data };
  }

  // ¿Esta sesión se sincroniza con el servidor? (solo las cuentas reales)
  const syncEnabled = (session) => Boolean(API_URL && session && session.provider === "account" && session.server === true);

  /* --- Sesión guardada en este dispositivo --- */
  function getSession() {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      const valid = session && typeof session.sub === "string" && ["account", "dev"].includes(session.provider);
      return valid ? session : null;
    } catch {
      return null;
    }
  }

  function saveSession(session) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* Sin almacenamiento disponible: la sesión dura lo que dure la página. */
    }
  }

  /* --- Crear cuenta e iniciar sesión --- */
  // Códigos de error del servidor → clave de texto de la pantalla de acceso (login.error.<clave>).
  const ERROR_KEYS = {
    invalid_credentials: "credentials",
    email_taken: "emailTaken",
    too_many_attempts: "tooMany",
    invalid_email: "invalidEmail",
    weak_password: "weakPassword",
    password_too_long: "passwordTooLong",
  };

  async function authenticate(action, email, password) {
    let result;
    try {
      result = await api(action, { email, password });
    } catch {
      return { error: "network" };
    }

    if (result.ok && result.data && result.data.user) {
      const session = {
        sub: result.data.user.sub, // identificador único de la cuenta
        email: result.data.user.email || email,
        provider: "account",
        server: true,
        signedInAt: Date.now(),
      };
      saveSession(session);
      return { session };
    }

    const code = result.data && result.data.error;
    if (ERROR_KEYS[code]) return { error: ERROR_KEYS[code] };

    // Cualquier otra respuesta es un fallo del servidor, no de las credenciales.
    if (typeof code === "string") {
      console.warn(`Flucti: el servidor rechazó la petición (${code}).`);
    } else {
      console.warn(
        `Flucti: ${API_URL} respondió HTTP ${result.status} sin el formato esperado. ` +
          'Comprueba que la app se sirve con PHP (Live Server no ejecuta PHP; prueba con "php -S localhost:8000").'
      );
    }
    return { error: "server" };
  }

  const signIn = (email, password) => authenticate("login", email, password);
  const register = (email, password) => authenticate("register", email, password);

  // Para desarrollo: sesión local sin servidor (solo se ofrece si no hay servidor disponible).
  function startDevSession() {
    const session = { sub: "dev", email: "", provider: "dev", server: false, signedInAt: Date.now() };
    saveSession(session);
    return session;
  }

  function signOut(session) {
    if (syncEnabled(session)) api("logout").catch(() => {}); // cierra también la sesión del servidor
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* se ignora */
    }
  }

  return { canUseServer, getSession, signIn, register, startDevSession, signOut, api, syncEnabled };
})();