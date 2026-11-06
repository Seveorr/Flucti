/* ==========================================================================
   languages.js — base de datos de idiomas y traducciones

   Cómo editarla:
   - Cada elemento con texto de la aplicación tiene una clave en TRANSLATIONS
     y, dentro, su texto en todos los idiomas de LANGUAGES.
   - Cambia cualquier texto y se actualiza solo al recargar la página.
   - {name}, {language}… son valores que la aplicación rellena; no los borres.
   - Para añadir un idioma: agrégalo a LANGUAGES y añade su código a cada clave.
   - Para añadir un texto nuevo: crea una clave nueva y úsala en el HTML con
     data-i18n="clave" (texto), data-i18n-aria-label="clave" o
     data-i18n-placeholder="clave", o desde el JS con t("clave").
   - Si falta una traducción, la consola del navegador lo avisa y se usa el
     primer idioma de la lista.
   ========================================================================== */

// "label" son las dos letras del botón; "locale" da formato a la fecha.
const LANGUAGES = [
  { code: "es", label: "ES", name: "Español", locale: "es-ES" },
  { code: "ca", label: "CA", name: "Català", locale: "ca-ES" },
  { code: "en", label: "EN", name: "English", locale: "en-GB" },
  { code: "de", label: "DE", name: "Deutsch", locale: "de-DE" },
];

const TRANSLATIONS = {
  /* General: el nombre de la app es el mismo en todos los idiomas */
  "app.title": { es: "Flucti", ca: "Flucti", en: "Flucti", de: "Flucti" },

  /* Pantalla de inicio */
  "home.label": { es: "Inicio", ca: "Inici", en: "Home", de: "Start" },
  "greeting.morning": { es: "Buenos días", ca: "Bon dia", en: "Good morning", de: "Guten Morgen" },
  "greeting.afternoon": { es: "Buenas tardes", ca: "Bona tarda", en: "Good afternoon", de: "Guten Tag" },
  "greeting.night": { es: "Buenas noches", ca: "Bona nit", en: "Good evening", de: "Guten Abend" },
  "scroll.label": { es: "Ver tareas", ca: "Veure tasques", en: "Show tasks", de: "Aufgaben anzeigen" },

  /* Barra superior y menú */
  "menu.open": { es: "Abrir menú", ca: "Obre el menú", en: "Open menu", de: "Menü öffnen" },
  "menu.title": { es: "Menú", ca: "Menú", en: "Menu", de: "Menü" },
  "menu.close": { es: "Cerrar", ca: "Tanca", en: "Close", de: "Schließen" },
  "language.change": {
    es: "Cambiar idioma (actual: {language})",
    ca: "Canvia l'idioma (actual: {language})",
    en: "Change language (current: {language})",
    de: "Sprache ändern (aktuell: {language})",
  },

  /* Lista de tareas */
  "tasks.title": { es: "Tareas", ca: "Tasques", en: "Tasks", de: "Aufgaben" },
  "task.input.label": { es: "Nombre de la tarea", ca: "Nom de la tasca", en: "Task name", de: "Name der Aufgabe" },
  "task.input.placeholder": { es: "Nombre de la tarea", ca: "Nom de la tasca", en: "Task name", de: "Name der Aufgabe" },
  "task.add": { es: "Añadir", ca: "Afegeix", en: "Add", de: "Hinzufügen" },
  "task.complete": {
    es: "Completar tarea: {name}",
    ca: "Completa la tasca: {name}",
    en: "Complete task: {name}",
    de: "Aufgabe erledigen: {name}",
  },
  "task.empty": {
    es: "No tienes tareas pendientes. Escribe una arriba y pulsa Añadir.",
    ca: "No tens tasques pendents. Escriu-ne una a dalt i prem Afegeix.",
    en: "You have no pending tasks. Type one above and press Add.",
    de: "Du hast keine offenen Aufgaben. Schreibe oben eine und drücke Hinzufügen.",
  },
};

// Aviso en la consola si falta alguna traducción (útil al editar a mano).
for (const [key, texts] of Object.entries(TRANSLATIONS)) {
  for (const { code } of LANGUAGES) {
    if (typeof texts[code] !== "string" || texts[code] === "") {
      console.warn(`languages.js: falta la traducción "${code}" de "${key}".`);
    }
  }
}