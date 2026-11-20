# Flucti

Gestor de tareas minimalista, limpio y ordenado. La pantalla de inicio muestra la hora con segundos, un saludo y la fecha, y el fondo cambia con el cielo real del lugar donde estás: la hora, la época del año y el tiempo atmosférico. Al deslizar hacia abajo aparecen tus listas de tareas.

Funciona **solo en tu navegador**: no hay servidor ni cuentas, y las tareas se guardan en este dispositivo.

## Qué hace

- **Cielo dinámico.** El color de fondo sigue la posición real del sol (hora azul, hora dorada, día y noche) según tu ubicación, y cambia con el tiempo: sol, nubes, lluvia, nieve, tormenta con rayos y niebla.
- **Listas.** Cada lista es un recuadro con sus tareas dentro. En pantallas grandes hay dos columnas que se reparten **por altura**, sin cambiar el orden: si la primera lista es tan larga como tres vacías, va sola a la izquierda y las otras a la derecha. En las pequeñas hay una sola columna. Por defecto hay una llamada "Actual"; se crean con el recuadro de "Nueva lista". Se pueden ocultar, renombrar y eliminar. En las opciones de cada lista hay tres apartados: **Parámetros**, **Aspecto** y **Orden**, además de decidir si se muestran las tareas completadas.
- **Tareas.** Escribe el título en el recuadro de la lista y pulsa **+** para guardarla, o abre sus **parámetros** (botón de al lado) para completar más datos. Si falta un parámetro obligatorio no se guarda y se avisa de cuál es.
  - *Únicas*: descripción, fecha de vencimiento (hora opcional), fecha de planificación (opcional) y energía (alta, media o baja).
  - *Recurrentes*: lo mismo, más cada cuánto se repite (cada N días, semanas, meses o años) o en qué días de la semana. Al completarlas pasan a su siguiente fecha.
  - Las que vencen **mañana** se resaltan.
  - Al completar una tarea se **marca, no se borra**: se puede mostrar u ocultar desde las opciones de la lista y recuperar desmarcándola.
- **Orden por lista.** Por defecto: primero las que vencen antes y, a igual fecha, las que más energía suponen. Se puede cambiar en las opciones de cada lista.
- **Parámetros por lista.** Cada lista tiene los suyos y cambiarlos no afecta a las demás. En *Ajustes → Parámetros por defecto* se eligen los que reciben las listas **nuevas** (al principio, los de siempre). En los parámetros se elige en qué tipos de tarea aparece cada uno y si es obligatorio, se pueden añadir los propios (texto, texto largo, número, fecha, lista desplegable o sí/no), editar el nombre y las opciones de los propios y quitar cualquiera excepto el título. **Todas las listas desplegables, también la energía, se editan con un editor de opciones**: una fila por opción con su color, su nombre y botones para subirla o quitarla (Enter en un nombre abre otra opción debajo). El color de cada opción se ve como un punto junto al texto, en el contorno de la etiqueta, en el relleno de la etiqueta de color y en las barras de la energía; la primera opción es la "mayor" al ordenar. Los datos que ya tenían las tareas no se pierden al quitar un parámetro: se pueden restaurar.
- **Aspecto de los parámetros.** En el apartado *Aspecto* de cada lista se elige cómo se ve cada parámetro: **título**, **descripción**, **dato** (texto pequeño, como ahora), **etiqueta** (palabra con contorno), **etiqueta de color** (rellena del color que elijas) u **oculto**, y se cambia el orden en que aparecen. Los datos y etiquetas seguidos se juntan en una misma fila.
- **Ajustes.** Tres apartados: *Parámetros por defecto*, *Listas* y *Acerca de*.
- **Cuatro idiomas:** español, catalán, inglés y alemán. Todos los textos están en `languages.js` y se pueden editar a mano.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Estructura de la página y ventanas |
| `style.css` | Estilos y paletas del cielo |
| `script.js` | Reloj, cielo, tiempo atmosférico y desplazamiento entre pantallas |
| `tasks.js` | Tareas, listas, parámetros (por lista), aspecto, orden y recurrencias |
| `ui.js` | Componentes propios: desplegables (con color por opción), calendario, selector de hora y deslizador |
| `i18n.js` | Lógica de idiomas y utilidades comunes |
| `languages.js` | Idiomas y traducciones (el único archivo que hay que tocar para cambiar textos) |

## Usarlo

No necesita instalar nada: basta con servir la carpeta con cualquier servidor estático (por ejemplo la extensión Live Server de VS Code, o `python3 -m http.server`) y abrir `index.html`. También funciona en **GitHub Pages**.

Si abres `index.html` directamente como archivo, el navegador puede bloquear la ubicación; en ese caso la app usa Igualada como lugar por defecto.

## Tus datos

Todo se guarda en `localStorage`, en este navegador y dispositivo. Si borras los datos del sitio, se pierden las tareas, y no se sincronizan entre dispositivos.

**Las actualizaciones no borran tareas.** Cuando cambia el formato de los datos, la app guarda antes una copia exacta de lo que había (`flucti:data:v1:backup-v2`, `…:corrupt` si los datos no se podían leer) y migra sin descartar ninguna tarea. Al pasar a parámetros por lista, cada lista existente conserva los parámetros que tenía y se ve igual que antes.

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