# Flucti

Gestor de tareas minimalista, limpio y ordenado. La pantalla de inicio muestra la hora con segundos, un saludo, la fecha y tus listas, y el fondo cambia con el cielo real del lugar donde estás: la hora, la época del año y el tiempo atmosférico. Al deslizar hacia abajo aparece la lista de tareas.

Funciona **solo en tu navegador**: no hay servidor ni cuentas, y las tareas se guardan en este dispositivo.

## Qué hace

- **Cielo dinámico.** El color de fondo sigue la posición real del sol (hora azul, hora dorada, día y noche) según tu ubicación, y cambia con el tiempo: sol, nubes, lluvia, nieve, tormenta con rayos y niebla.
- **Listas.** Se crean y se eligen en la pantalla de inicio. Por defecto hay una llamada "Actual". Se pueden ocultar, renombrar y eliminar, y cada una tiene su propio orden.
- **Tareas.** Escribe el título y pulsa **+** para guardarla, o abre sus **parámetros** (botón de al lado) para completar más datos.
  - *Únicas*: descripción, fecha de vencimiento (hora opcional), fecha de planificación (opcional) y energía (alta, media o baja).
  - *Recurrentes*: lo mismo, más cada cuánto se repite (cada N días, semanas, meses o años) o en qué días de la semana. Al completarlas pasan a su siguiente fecha.
  - Las que vencen **mañana** se resaltan.
- **Orden por lista.** Por defecto: primero las que vencen antes y, a igual fecha, las que más energía suponen. Se puede cambiar en las opciones de cada lista.
- **Parámetros configurables.** En Ajustes se elige qué parámetros lleva cada tipo de tarea, cuáles son obligatorios y se pueden añadir los propios (texto, texto largo, número, fecha, lista desplegable o sí/no). El título siempre está.
- **Cuatro idiomas:** español, catalán, inglés y alemán. Todos los textos están en `languages.js` y se pueden editar a mano.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Estructura de la página y ventanas |
| `style.css` | Estilos y paletas del cielo |
| `script.js` | Reloj, cielo, tiempo atmosférico y desplazamiento entre pantallas |
| `tasks.js` | Tareas, listas, parámetros, orden y recurrencias |
| `i18n.js` | Lógica de idiomas y utilidades comunes |
| `languages.js` | Idiomas y traducciones (el único archivo que hay que tocar para cambiar textos) |

## Usarlo

No necesita instalar nada: basta con servir la carpeta con cualquier servidor estático (por ejemplo la extensión Live Server de VS Code, o `python3 -m http.server`) y abrir `index.html`. También funciona en **GitHub Pages**.

Si abres `index.html` directamente como archivo, el navegador puede bloquear la ubicación; en ese caso la app usa Igualada como lugar por defecto.

## Tus datos

Todo se guarda en `localStorage`, en este navegador y dispositivo. Si borras los datos del sitio, se pierden las tareas, y no se sincronizan entre dispositivos.

## Probar el cielo desde la consola

```js
testSky({ weather: "storm", time: "21:30", place: "tokyo" })
testSky("help")   // muestra todas las opciones
testSky()         // vuelve al estado real
```

Durante 60 segundos (o los que indiques en `duration`) la página hace caso a lo que pidas. Las fechas de las tareas (por ejemplo, qué vence "mañana") siguen también esa hora de prueba.

## Créditos

- Datos del tiempo: [Open-Meteo](https://open-meteo.com/) (licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)). Su uso gratuito es solo para proyectos no comerciales.
- Tipografía: [Manrope](https://fonts.google.com/specimen/Manrope) (SIL Open Font License), servida por Google Fonts.

## Licencia

Por definir.