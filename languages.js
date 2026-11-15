/* ==========================================================================
   languages.js — base de datos de idiomas y traducciones

   Cómo editarla:
   - Cada elemento con texto de la aplicación tiene una clave en TRANSLATIONS
     y, dentro, su texto en todos los idiomas de LANGUAGES.
   - Cambia cualquier texto y se actualiza solo al recargar la página.
   - {name}, {date}, {count}… son valores que la aplicación rellena; no los borres.
   - Las claves con ".one" y ".other" son singular y plural (1 día / 2 días).
   - Para añadir un idioma: agrégalo a LANGUAGES y añade su código a cada clave.
   - Para añadir un texto nuevo: crea una clave nueva y úsala en el HTML con
     data-i18n="clave" (texto), data-i18n-aria-label="clave" o
     data-i18n-placeholder="clave", o desde el JS con t("clave").
   - Si falta una traducción, la consola del navegador lo avisa y se usa el
     primer idioma de la lista.
   ========================================================================== */

// "label" son las dos letras del botón; "locale" da formato a las fechas.
const LANGUAGES = [
  { code: "es", label: "ES", name: "Español", locale: "es-ES" },
  { code: "ca", label: "CA", name: "Català", locale: "ca-ES" },
  { code: "en", label: "EN", name: "English", locale: "en-GB" },
  { code: "de", label: "DE", name: "Deutsch", locale: "de-DE" },
];

const TRANSLATIONS = {
  /* General */
  "app.title": { es: "Flucti", ca: "Flucti", en: "Flucti", de: "Flucti" },
  "dialog.close": { es: "Cerrar", ca: "Tanca", en: "Close", de: "Schließen" },
  "language.change": {
    es: "Cambiar idioma (actual: {language})",
    ca: "Canvia l'idioma (actual: {language})",
    en: "Change language (current: {language})",
    de: "Sprache ändern (aktuell: {language})",
  },

  /* Pantalla de inicio */
  "home.label": { es: "Inicio", ca: "Inici", en: "Home", de: "Start" },
  "greeting.morning": { es: "Buenos días", ca: "Bon dia", en: "Good morning", de: "Guten Morgen" },
  "greeting.afternoon": { es: "Buenas tardes", ca: "Bona tarda", en: "Good afternoon", de: "Guten Tag" },
  "greeting.night": { es: "Buenas noches", ca: "Bona nit", en: "Good evening", de: "Guten Abend" },
  "scroll.label": { es: "Ver tareas", ca: "Veure tasques", en: "Show tasks", de: "Aufgaben anzeigen" },

  /* Listas (en la pantalla de inicio y en la hoja de tareas) */
  "list.default": { es: "Actual", ca: "Actual", en: "Current", de: "Aktuell" },
  "list.add": { es: "Crear lista", ca: "Crea una llista", en: "Create list", de: "Liste erstellen" },
  "list.new.placeholder": { es: "Nueva lista", ca: "Nova llista", en: "New list", de: "Neue Liste" },
  "list.options": { es: "Opciones de la lista", ca: "Opcions de la llista", en: "List options", de: "Listenoptionen" },

  /* Barra superior y ajustes */
  "menu.open": { es: "Abrir ajustes", ca: "Obrir la configuració", en: "Open settings", de: "Einstellungen öffnen" },
  "menu.title": { es: "Ajustes", ca: "Configuració", en: "Settings", de: "Einstellungen" },

  /* Hoja de tareas */
  "tasks.section": { es: "Tareas", ca: "Tasques", en: "Tasks", de: "Aufgaben" },
  "task.input.label": { es: "Nombre de la tarea", ca: "Nom de la tasca", en: "Task name", de: "Name der Aufgabe" },
  "task.input.placeholder": { es: "Nombre de la tarea", ca: "Nom de la tasca", en: "Task name", de: "Name der Aufgabe" },
  "task.save": { es: "Guardar tarea", ca: "Desa la tasca", en: "Save task", de: "Aufgabe speichern" },
  "task.params": {
    es: "Parámetros de la tarea",
    ca: "Paràmetres de la tasca",
    en: "Task parameters",
    de: "Aufgabenparameter",
  },
  "task.complete": {
    es: "Completar tarea: {name}",
    ca: "Completa la tasca: {name}",
    en: "Complete task: {name}",
    de: "Aufgabe erledigen: {name}",
  },
  "task.empty": {
    es: "No hay tareas pendientes en esta lista. Escribe una arriba y pulsa +.",
    ca: "No hi ha tasques pendents en aquesta llista. Escriu-ne una a dalt i prem +.",
    en: "No pending tasks in this list. Type one above and press +.",
    de: "Keine offenen Aufgaben in dieser Liste. Schreibe oben eine und drücke +.",
  },

  /* Ventana de la tarea */
  "task.dialog.new": { es: "Nueva tarea", ca: "Nova tasca", en: "New task", de: "Neue Aufgabe" },
  "task.kind.label": { es: "Tipo de tarea", ca: "Tipus de tasca", en: "Task type", de: "Aufgabentyp" },
  "kind.once": { es: "Única", ca: "Única", en: "One-time", de: "Einmalig" },
  "kind.recurring": { es: "Recurrente", ca: "Recurrent", en: "Recurring", de: "Wiederkehrend" },
  "task.saveButton": { es: "Guardar", ca: "Desa", en: "Save", de: "Speichern" },
  "task.error.missing": {
    es: "Falta rellenar: {names}",
    ca: "Falta omplir: {names}",
    en: "Missing: {names}",
    de: "Bitte ausfüllen: {names}",
  },
  "task.completed.title": { es: "Completadas", ca: "Completades", en: "Completed", de: "Erledigt" },
  "cal.prev": { es: "Mes anterior", ca: "Mes anterior", en: "Previous month", de: "Vorheriger Monat" },
  "cal.next": { es: "Mes siguiente", ca: "Mes següent", en: "Next month", de: "Nächster Monat" },
  "field.clear": { es: "Quitar", ca: "Treu", en: "Clear", de: "Entfernen" },
  "field.date": { es: "Fecha", ca: "Data", en: "Date", de: "Datum" },
  "field.time": { es: "Hora (opcional)", ca: "Hora (opcional)", en: "Time (optional)", de: "Uhrzeit (optional)" },
  "field.none": { es: "—", ca: "—", en: "—", de: "—" },

  /* Nombres de los parámetros que trae la app */
  "param.title": { es: "Título", ca: "Títol", en: "Title", de: "Titel" },
  "param.description": { es: "Descripción", ca: "Descripció", en: "Description", de: "Beschreibung" },
  "param.due": { es: "Fecha de vencimiento", ca: "Data de venciment", en: "Due date", de: "Fälligkeitsdatum" },
  "param.date": { es: "Fecha", ca: "Data", en: "Date", de: "Datum" },
  "param.repeat": { es: "Repetición", ca: "Repetició", en: "Repeat", de: "Wiederholung" },
  "param.planned": { es: "Fecha de planificación", ca: "Data de planificació", en: "Planned date", de: "Geplantes Datum" },
  "param.energy": { es: "Energía", ca: "Energia", en: "Energy", de: "Energie" },
  "energy.high": { es: "Alta", ca: "Alta", en: "High", de: "Hoch" },
  "energy.medium": { es: "Media", ca: "Mitjana", en: "Medium", de: "Mittel" },
  "energy.low": { es: "Baja", ca: "Baixa", en: "Low", de: "Niedrig" },

  /* Tipos de parámetro */
  "type.text": { es: "Texto", ca: "Text", en: "Text", de: "Text" },
  "type.textarea": { es: "Texto largo", ca: "Text llarg", en: "Long text", de: "Langer Text" },
  "type.number": { es: "Número", ca: "Número", en: "Number", de: "Zahl" },
  "type.date": {
    es: "Fecha (hora opcional)",
    ca: "Data (hora opcional)",
    en: "Date (optional time)",
    de: "Datum (Uhrzeit optional)",
  },
  "type.select": { es: "Lista desplegable", ca: "Llista desplegable", en: "Dropdown list", de: "Dropdown-Liste" },
  "type.checkbox": { es: "Sí / No", ca: "Sí / No", en: "Yes / No", de: "Ja / Nein" },
  "type.recurrence": { es: "Regla de repetición", ca: "Regla de repetició", en: "Repeat rule", de: "Wiederholungsregel" },

  /* Repetición de las tareas recurrentes */
  "repeat.mode.label": { es: "Tipo de repetición", ca: "Tipus de repetició", en: "Repeat type", de: "Wiederholungsart" },
  "repeat.mode.interval": { es: "Cada cierto tiempo", ca: "Cada cert temps", en: "Every so often", de: "In Abständen" },
  "repeat.mode.weekdays": { es: "Días de la semana", ca: "Dies de la setmana", en: "Weekdays", de: "Wochentage" },
  "repeat.every": { es: "Cada", ca: "Cada", en: "Every", de: "Alle" },
  "repeat.unit.day.one": { es: "día", ca: "dia", en: "day", de: "Tag" },
  "repeat.unit.day.other": { es: "días", ca: "dies", en: "days", de: "Tage" },
  "repeat.unit.week.one": { es: "semana", ca: "setmana", en: "week", de: "Woche" },
  "repeat.unit.week.other": { es: "semanas", ca: "setmanes", en: "weeks", de: "Wochen" },
  "repeat.unit.month.one": { es: "mes", ca: "mes", en: "month", de: "Monat" },
  "repeat.unit.month.other": { es: "meses", ca: "mesos", en: "months", de: "Monate" },
  "repeat.unit.year.one": { es: "año", ca: "any", en: "year", de: "Jahr" },
  "repeat.unit.year.other": { es: "años", ca: "anys", en: "years", de: "Jahre" },
  "repeat.summary.day": { es: "Cada día", ca: "Cada dia", en: "Every day", de: "Jeden Tag" },
  "repeat.summary.week": { es: "Cada semana", ca: "Cada setmana", en: "Every week", de: "Jede Woche" },
  "repeat.summary.month": { es: "Cada mes", ca: "Cada mes", en: "Every month", de: "Jeden Monat" },
  "repeat.summary.year": { es: "Cada año", ca: "Cada any", en: "Every year", de: "Jedes Jahr" },
  "repeat.summary.many": {
    es: "Cada {count} {unit}",
    ca: "Cada {count} {unit}",
    en: "Every {count} {unit}",
    de: "Alle {count} {unit}",
  },

  /* Fechas en la lista */
  "due.today": { es: "Hoy", ca: "Avui", en: "Today", de: "Heute" },
  "due.tomorrow": { es: "Mañana", ca: "Demà", en: "Tomorrow", de: "Morgen" },
  "due.overdue": { es: "Vencida · {date}", ca: "Vençuda · {date}", en: "Overdue · {date}", de: "Überfällig · {date}" },
  "meta.planned": { es: "Plan: {date}", ca: "Pla: {date}", en: "Plan: {date}", de: "Plan: {date}" },

  /* Ajustes: parámetros de las tareas */
  "settings.params": {
    es: "Parámetros de las tareas",
    ca: "Paràmetres de les tasques",
    en: "Task parameters",
    de: "Aufgabenparameter",
  },
  "settings.params.hint": {
    es: "Elige qué datos tiene una tarea. El título es fijo.",
    ca: "Tria quines dades té una tasca. El títol és fixe.",
    en: "Choose what data a task has. The title is fixed.",
    de: "Lege fest, welche Angaben eine Aufgabe hat. Der Titel ist fix.",
  },
  "settings.back": { es: "Volver", ca: "Tornar", en: "Back", de: "Zurück" },
  "settings.params.restore": {
    es: "Parámetros eliminados",
    ca: "Paràmetres eliminats",
    en: "Removed parameters",
    de: "Entfernte Parameter",
  },
  "col.once": { es: "Única", ca: "Única", en: "Once", de: "Einmal" },
  "col.recurring": { es: "Recurr.", ca: "Recurr.", en: "Repeat", de: "Wiederh." },
  "col.required": { es: "Oblig.", ca: "Oblig.", en: "Req.", de: "Pflicht" },
  "param.required": { es: "Obligatorio", ca: "Obligatori", en: "Required", de: "Pflichtfeld" },
  "param.add": { es: "Añadir parámetro", ca: "Afegeix un paràmetre", en: "Add parameter", de: "Parameter hinzufügen" },
  "param.name": { es: "Nombre del parámetro", ca: "Nom del paràmetre", en: "Parameter name", de: "Parametername" },
  "param.type": { es: "Tipo", ca: "Tipus", en: "Type", de: "Typ" },
  "param.options": {
    es: "Opciones separadas por comas",
    ca: "Opcions separades per comes",
    en: "Options separated by commas",
    de: "Optionen, durch Kommas getrennt",
  },
  "param.create": { es: "Añadir", ca: "Afegeix", en: "Add", de: "Hinzufügen" },
  "param.cancel": { es: "Cancelar", ca: "Cancel·la", en: "Cancel", de: "Abbrechen" },
  "param.remove": { es: "Eliminar parámetro", ca: "Elimina el paràmetre", en: "Remove parameter", de: "Parameter entfernen" },
  "param.error": {
    es: "Escribe un nombre. Si es una lista, añade al menos una opción.",
    ca: "Escriu un nom. Si és una llista, afegeix almenys una opció.",
    en: "Enter a name. For a list, add at least one option.",
    de: "Gib einen Namen ein. Bei einer Liste mindestens eine Option.",
  },

  /* Ajustes: listas */
  "settings.lists": { es: "Listas", ca: "Llistes", en: "Lists", de: "Listen" },
  "list.show": { es: "Mostrar en inicio", ca: "Mostra a l'inici", en: "Show on home", de: "Auf dem Start zeigen" },
  "list.hide": { es: "Ocultar en inicio", ca: "Amaga a l'inici", en: "Hide on home", de: "Auf dem Start ausblenden" },
  "list.showCompleted": {
    es: "Mostrar tareas completadas",
    ca: "Mostra les tasques completades",
    en: "Show completed tasks",
    de: "Erledigte Aufgaben anzeigen",
  },
  "list.edit": { es: "Editar lista", ca: "Edita la llista", en: "Edit list", de: "Liste bearbeiten" },
  "list.hidden": { es: "Oculta", ca: "Amagada", en: "Hidden", de: "Ausgeblendet" },

  /* Ventana de una lista */
  "list.dialog.title": { es: "Lista", ca: "Llista", en: "List", de: "Liste" },
  "list.name": { es: "Nombre", ca: "Nom", en: "Name", de: "Name" },
  "list.sort": { es: "Orden de las tareas", ca: "Ordre de les tasques", en: "Task order", de: "Reihenfolge der Aufgaben" },
  "list.sort.hint": {
    es: "Se ordena por el primer criterio y, si empatan, por el siguiente.",
    ca: "S'ordena pel primer criteri i, si empaten, pel següent.",
    en: "Sorted by the first criterion, then by the next one when tied.",
    de: "Zuerst nach dem ersten Kriterium, bei Gleichstand nach dem nächsten.",
  },
  "sort.add": { es: "Añadir criterio", ca: "Afegeix un criteri", en: "Add criterion", de: "Kriterium hinzufügen" },
  "sort.remove": { es: "Quitar criterio", ca: "Treu el criteri", en: "Remove criterion", de: "Kriterium entfernen" },
  "sort.up": { es: "Subir prioridad", ca: "Puja la prioritat", en: "Raise priority", de: "Priorität erhöhen" },
  "sort.created": { es: "Fecha de creación", ca: "Data de creació", en: "Creation date", de: "Erstellungsdatum" },
  "dir.date.asc": { es: "Primero las más próximas", ca: "Primer les més properes", en: "Soonest first", de: "Früheste zuerst" },
  "dir.date.desc": { es: "Primero las más lejanas", ca: "Primer les més llunyanes", en: "Latest first", de: "Späteste zuerst" },
  "dir.level.asc": { es: "De menos a más", ca: "De menys a més", en: "Low to high", de: "Niedrig zuerst" },
  "dir.level.desc": { es: "De más a menos", ca: "De més a menys", en: "High to low", de: "Hoch zuerst" },
  "dir.text.asc": { es: "A → Z", ca: "A → Z", en: "A → Z", de: "A → Z" },
  "dir.text.desc": { es: "Z → A", ca: "Z → A", en: "Z → A", de: "Z → A" },
  "dir.number.asc": { es: "De menor a mayor", ca: "De menor a major", en: "Smallest first", de: "Kleinste zuerst" },
  "dir.number.desc": { es: "De mayor a menor", ca: "De major a menor", en: "Largest first", de: "Größte zuerst" },
  "dir.created.asc": { es: "Más antiguas primero", ca: "Primer les més antigues", en: "Oldest first", de: "Älteste zuerst" },
  "dir.created.desc": { es: "Más recientes primero", ca: "Primer les més recents", en: "Newest first", de: "Neueste zuerst" },
  "list.delete": { es: "Eliminar lista", ca: "Elimina la llista", en: "Delete list", de: "Liste löschen" },
  "list.delete.confirm": {
    es: "Pulsa otra vez para eliminar la lista y sus tareas",
    ca: "Prem una altra vegada per eliminar la llista i les seves tasques",
    en: "Press again to delete the list and its tasks",
    de: "Noch einmal drücken, um die Liste und ihre Aufgaben zu löschen",
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