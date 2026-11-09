# Flucti

Gestor de tareas minimalista, limpio y ordenado. La pantalla de inicio muestra la hora con segundos, un saludo y la fecha, y el fondo cambia con el cielo real del lugar donde estás: la hora, la época del año y el tiempo atmosférico. Al deslizar hacia abajo aparece la lista de tareas.

## Qué hace

- **Cielo dinámico.** El color de fondo sigue la posición real del sol (hora azul, hora dorada, día y noche) según tu ubicación, y cambia con el tiempo: sol, nubes, lluvia, nieve, tormenta con rayos y niebla.
- **Tareas.** Añade tareas y complétalas con un clic. Se guardan en el dispositivo y se sincronizan entre dispositivos con la misma cuenta.
- **Cuentas con correo y contraseña.** Las contraseñas se guardan solo como hash. Hay límite de intentos y sesión de 30 días.
- **Cuatro idiomas:** español, catalán, inglés y alemán. Todos los textos están en `languages.js` y se pueden editar a mano.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Estructura de la página |
| `style.css` | Estilos y paletas del cielo |
| `script.js` | Lógica: reloj, cielo, clima, tareas, sesión y sincronización |
| `languages.js` | Idiomas y traducciones |
| `auth.js` | Cuentas en el navegador (conexión con `api.php`) |
| `api.php` | Servidor: cuentas, sesiones y sincronización (SQLite) |

## Probarlo en local

Hace falta **PHP 8.1 o superior** con la extensión `pdo_sqlite` (se comprueba con `php -m`).

```bash
php -S localhost:8000
```

Abre `http://localhost:8000`. Hay que usar el servidor de PHP: **Live Server de VS Code no sirve**, porque no ejecuta PHP.

Sin PHP también se puede ver la interfaz poniendo `const API_URL = ""` en `auth.js`: entonces no hay cuentas ni sincronización, y se ofrece un modo de desarrollo con las tareas guardadas solo en el navegador.

## Poner la app en un servidor

1. Sube todos los archivos a un servidor con PHP 8.1+ y HTTPS.
2. Mueve la carpeta de datos **fuera de la web**: cambia `DATA_DIR` al principio de `api.php` (por ejemplo, `/var/lib/flucti`). Ahí se guardan las cuentas y las sesiones. Con Apache se protege sola con un `.htaccess`, pero en otros servidores no.
3. Si el servidor está detrás de un proxy inverso, configúralo para que PHP vea la IP real del usuario (el límite de intentos se hace por IP).

GitHub Pages no sirve para esto, porque solo aloja páginas estáticas y no ejecuta PHP.

## Probar el cielo desde la consola

```js
testSky({ weather: "storm", time: "21:30", place: "tokyo" })
testSky("help")   // muestra todas las opciones
testSky()         // vuelve al estado real
```

Durante 60 segundos (o los que indiques en `duration`) la página hace caso a lo que pidas.

## Seguridad

- Las contraseñas nunca se guardan en claro (`password_hash`) ni en el navegador.
- Todas las peticiones al servidor deben venir de su propia web (comprobación de origen) y ser JSON.
- Límite de intentos fallidos por correo y por IP, y de cuentas nuevas por IP.
- Si encuentras un problema de seguridad, avisa de forma privada (con una *Security advisory* de GitHub) antes de publicarlo.

## Créditos

- Datos del tiempo: [Open-Meteo](https://open-meteo.com/) (licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)). Su uso gratuito es solo para proyectos no comerciales.
- Tipografía: [Manrope](https://fonts.google.com/specimen/Manrope) (SIL Open Font License), servida por Google Fonts.

## Licencia

Por definir.