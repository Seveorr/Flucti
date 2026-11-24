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
  "list.add": { es: "Nuevo", ca: "Nou", en: "New", de: "Neu" },
  "list.new": { es: "Nuevo", ca: "Nou", en: "New", de: "Neu" },
  "list.new.placeholder": { es: "Nueva lista", ca: "Nova llista", en: "New list", de: "Neue Liste" },
  "list.options": { es: "Opciones de la lista", ca: "Opcions de la llista", en: "List options", de: "Listenoptionen" },

  /* Barra superior y ajustes */
  "menu.open": { es: "Abrir ajustes", ca: "Obre la configuració", en: "Open settings", de: "Einstellungen öffnen" },
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
  "task.dialog.edit": { es: "Editar tarea", ca: "Editar tasca", en: "Edit task", de: "Aufgabe bearbeiten" },
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
  "task.error.title": {
    es: "Sin título, la tarea se descarta.",
    ca: "Sense títol, la tasca es descarta.",
    en: "Without a title, the task is discarded.",
    de: "Ohne Titel wird die Aufgabe verworfen.",
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
    es: "Parámetros por defecto",
    ca: "Paràmetres per defecte",
    en: "Default parameters",
    de: "Standardparameter",
  },
  "settings.params.hint": {
    es: "Parámetros con los que empiezan las listas nuevas. Cada lista puede cambiar los suyos en sus opciones.",
    ca: "Paràmetres amb què comencen les llistes noves. Cada llista pot canviar els seus a les seves opcions.",
    en: "Parameters that new lists start with. Each list can change its own in its options.",
    de: "Parameter, mit denen neue Listen starten. Jede Liste kann ihre eigenen in ihren Optionen ändern.",
  },
  "settings.back": { es: "Volver", ca: "Enrere", en: "Back", de: "Zurück" },
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
    es: "Opciones",
    ca: "Opcions",
    en: "Options",
    de: "Optionen",
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

  /* Parámetros y aspecto de cada lista (ventana de la lista) */
  "list.tabs": { es: "Apartados de la lista", ca: "Apartats de la llista", en: "List sections", de: "Abschnitte der Liste" },
  "list.tab.params": { es: "Parámetros", ca: "Paràmetres", en: "Parameters", de: "Parameter" },
  "list.tab.layout": { es: "Aspecto", ca: "Aspecte", en: "Look", de: "Darstellung" },
  "param.source": { es: "Lista", ca: "Llista", en: "List", de: "Liste" },
  "list.tab.sort": { es: "Orden", ca: "Ordre", en: "Order", de: "Reihenfolge" },
  "list.kind.own": { es: "Lista de tareas independiente", ca: "Llista de tasques independent", en: "Independent task list", de: "Unabhängige Aufgabenliste" },
  "list.kind.own.hint": { es: "Tus propias tareas: aquí puedes añadir tareas nuevas.", ca: "Les teves pròpies tasques: aquí pots afegir-ne de noves.", en: "Your own tasks: add new ones here.", de: "Eigene Aufgaben: hier kannst du neue hinzufügen." },
  "list.kind.linked": { es: "Lista de tareas dependiente", ca: "Llista de tasques dependent", en: "Dependent task list", de: "Abhängige Aufgabenliste" },
  "list.kind.linked.hint": { es: "Reúne tareas de otras listas independientes que cumplan los requisitos que elijas.", ca: "Reuneix tasques d'altres llistes independents que compleixin els requisits que triïs.", en: "Gathers tasks from other independent lists that meet the requirements you choose.", de: "Sammelt Aufgaben aus anderen unabhängigen Listen, die deine Bedingungen erfüllen." },
  "list.kind.linked.short": { es: "dependiente", ca: "dependent", en: "dependent", de: "abhängig" },
  "list.tab.source": { es: "Origen", ca: "Origen", en: "Source", de: "Quelle" },
  "link.hint": { es: "Marca de qué listas vienen las tareas. Los parámetros de esta lista son todos los distintos que tengan esas listas, y con ellos configuras los requisitos, el aspecto y el orden. Las tareas se completan y se editan como en su lista.", ca: "Marca de quines llistes vénen les tasques. Els paràmetres d'aquesta llista són tots els diferents que tinguin aquestes llistes, i amb ells configures els requisits, l'aspecte i l'ordre. Les tasques es completen i s'editen com a la seva llista.", en: "Mark which lists the tasks come from. This list's parameters are all the different ones those lists have, and you use them to set the requirements, look and order. Tasks are completed and edited as in their own list.", de: "Markiere, aus welchen Listen die Aufgaben kommen. Die Parameter dieser Liste sind alle unterschiedlichen Parameter dieser Listen; damit stellst du Bedingungen, Darstellung und Reihenfolge ein. Aufgaben werden wie in ihrer Liste erledigt und bearbeitet." },
  "link.lists": { es: "Listas de origen", ca: "Llistes d'origen", en: "Source lists", de: "Quelllisten" },
  "link.filter": { es: "Requisitos", ca: "Requisits", en: "Requirements", de: "Bedingungen" },
  "link.filter.hint": { es: "Solo salen las tareas que cumplan los requisitos. Sin requisitos, salen todas.", ca: "Només surten les tasques que compleixin els requisits. Sense requisits, surten totes.", en: "Only tasks that meet the requirements are shown. With none, all tasks are shown.", de: "Es werden nur Aufgaben angezeigt, die die Bedingungen erfüllen. Ohne Bedingungen alle." },
  "link.empty": { es: "Elige en las opciones de qué listas salen las tareas.", ca: "Tria a les opcions de quines llistes surten les tasques.", en: "Choose in the options which lists the tasks come from.", de: "Wähle in den Optionen, aus welchen Listen die Aufgaben kommen." },
  "list.tab.highlight": { es: "Resaltado", ca: "Ressaltat", en: "Highlight", de: "Markierung" },
  "list.highlight.hint": { es: "Las tareas que cumplan las condiciones se resaltan con el color que elijas. Sin condiciones, no se resalta ninguna.", ca: "Les tasques que compleixin les condicions es ressalten amb el color que triïs. Sense condicions, no es ressalta cap.", en: "Tasks that meet the conditions are highlighted in the colour you choose. With no conditions, nothing is highlighted.", de: "Aufgaben, die die Bedingungen erfüllen, werden in der gewählten Farbe hervorgehoben. Ohne Bedingungen wird nichts hervorgehoben." },
  "hl.add": { es: "Añadir condición", ca: "Afegeix una condició", en: "Add condition", de: "Bedingung hinzufügen" },
  "hl.remove": { es: "Quitar condición", ca: "Treu la condició", en: "Remove condition", de: "Bedingung entfernen" },
  "hl.param": { es: "Parámetro", ca: "Paràmetre", en: "Parameter", de: "Parameter" },
  "hl.op": { es: "Condición", ca: "Condició", en: "Condition", de: "Bedingung" },
  "hl.value": { es: "Valor", ca: "Valor", en: "Value", de: "Wert" },
  "hl.missing": { es: "Parámetro eliminado de la lista", ca: "Paràmetre eliminat de la llista", en: "Parameter removed from the list", de: "Parameter aus der Liste entfernt" },
  "hl.match.label": { es: "Se resalta cuando se cumple", ca: "Es ressalta quan es compleix", en: "Highlight when", de: "Hervorheben, wenn erfüllt" },
  "hl.match.all": { es: "Todas las condiciones", ca: "Totes les condicions", en: "All conditions", de: "Alle Bedingungen" },
  "hl.match.any": { es: "Alguna condición", ca: "Alguna condició", en: "Any condition", de: "Eine der Bedingungen" },
  "hl.color": { es: "Color del resaltado", ca: "Color del ressaltat", en: "Highlight colour", de: "Farbe der Hervorhebung" },
  "hl.color.auto": { es: "Automático (el del tema)", ca: "Automàtic (el del tema)", en: "Automatic (theme colour)", de: "Automatisch (Themenfarbe)" },
  "hl.blink": { es: "Que parpadee", ca: "Fes que pampalluguegi", en: "Make it blink", de: "Blinken lassen" },
  "hl.op.overdue": { es: "Está vencida", ca: "Està vençuda", en: "Is overdue", de: "Ist überfällig" },
  "hl.op.today": { es: "Es hoy", ca: "És avui", en: "Is today", de: "Ist heute" },
  "hl.op.inDays": { es: "Es dentro de … días (1 = mañana)", ca: "És d'aquí a … dies (1 = demà)", en: "Is in … days (1 = tomorrow)", de: "Ist in … Tagen (1 = morgen)" },
  "hl.op.withinDays": { es: "Es en los próximos … días", ca: "És en els propers … dies", en: "Is within the next … days", de: "Ist in den nächsten … Tagen" },
  "hl.op.empty": { es: "Está vacío", ca: "Està buit", en: "Is empty", de: "Ist leer" },
  "hl.op.notEmpty": { es: "Tiene valor", ca: "Té valor", en: "Has a value", de: "Hat einen Wert" },
  "hl.op.is": { es: "Es", ca: "És", en: "Is", de: "Ist" },
  "hl.op.isNot": { es: "No es", ca: "No és", en: "Is not", de: "Ist nicht" },
  "hl.op.contains": { es: "Contiene", ca: "Conté", en: "Contains", de: "Enthält" },
  "hl.op.gt": { es: "Es mayor que", ca: "És més gran que", en: "Is greater than", de: "Ist größer als" },
  "hl.op.lt": { es: "Es menor que", ca: "És més petit que", en: "Is less than", de: "Ist kleiner als" },
  "hl.op.eq": { es: "Es igual a", ca: "És igual a", en: "Equals", de: "Ist gleich" },
  "hl.op.checked": { es: "Está marcado", ca: "Està marcat", en: "Is checked", de: "Ist angekreuzt" },
  "hl.op.unchecked": { es: "No está marcado", ca: "No està marcat", en: "Is not checked", de: "Ist nicht angekreuzt" },
  "param.suggest.hint": { es: "Parámetros de otras listas", ca: "Paràmetres d'altres llistes", en: "Parameters from other lists", de: "Parameter aus anderen Listen" },
  "list.move": { es: "Mover la lista (arrastra o usa las flechas)", ca: "Mou la llista (arrossega o fes servir les fletxes)", en: "Move list (drag or use the arrow keys)", de: "Liste verschieben (ziehen oder Pfeiltasten)" },
  "list.open": { es: "Abrir la lista a pantalla completa", ca: "Obre la llista a pantalla completa", en: "Open list full screen", de: "Liste im Vollbild öffnen" },
  "list.back": { es: "Volver a las listas", ca: "Torna a les llistes", en: "Back to lists", de: "Zurück zu den Listen" },
  "task.delete": { es: "Eliminar tarea", ca: "Elimina la tasca", en: "Delete task", de: "Aufgabe löschen" },
  "task.delete.confirm": { es: "Pulsa otra vez para eliminar", ca: "Prem un altre cop per eliminar", en: "Press again to delete", de: "Zum Löschen erneut drücken" },
  "time.hour": { es: "Hora", ca: "Hora", en: "Hour", de: "Stunde" },
  "time.minute": { es: "Minutos", ca: "Minuts", en: "Minutes", de: "Minuten" },
  "rich.toolbar": { es: "Formato del texto", ca: "Format del text", en: "Text formatting", de: "Textformatierung" },
  "rich.bold": { es: "Negrita", ca: "Negreta", en: "Bold", de: "Fett" },
  "rich.italic": { es: "Cursiva", ca: "Cursiva", en: "Italic", de: "Kursiv" },
  "rich.strike": { es: "Tachado", ca: "Tallat", en: "Strikethrough", de: "Durchgestrichen" },
  "rich.ul": { es: "Lista con viñetas", ca: "Llista amb pics", en: "Bulleted list", de: "Aufzählung" },
  "rich.ol": { es: "Lista numerada", ca: "Llista numerada", en: "Numbered list", de: "Nummerierte Liste" },
  "list.params.hint": {
    es: "Solo afectan a esta lista. El título siempre está.",
    ca: "Només afecten aquesta llista. El títol sempre hi és.",
    en: "These only apply to this list. The title is always there.",
    de: "Gelten nur für diese Liste. Der Titel ist immer dabei.",
  },
  "list.layout.hint": {
    es: "Elige cómo se ve cada parámetro en la lista y en qué orden aparece.",
    ca: "Tria com es veu cada paràmetre a la llista i en quin ordre apareix.",
    en: "Choose how each parameter looks in the list and the order it appears in.",
    de: "Lege fest, wie jeder Parameter in der Liste aussieht und in welcher Reihenfolge er erscheint.",
  },
  "layout.style": { es: "Cómo se ve", ca: "Com es veu", en: "Appearance", de: "Darstellung" },
  "style.title": { es: "Título", ca: "Títol", en: "Title", de: "Titel" },
  "style.description": { es: "Descripción", ca: "Descripció", en: "Description", de: "Beschreibung" },
  "style.meta": { es: "Dato", ca: "Dada", en: "Detail", de: "Detail" },
  "style.tag": { es: "Etiqueta", ca: "Etiqueta", en: "Tag", de: "Etikett" },
  "style.badge": { es: "Etiqueta de color", ca: "Etiqueta de color", en: "Color tag", de: "Farbetikett" },
  "style.hidden": { es: "Oculto", ca: "Amagat", en: "Hidden", de: "Ausgeblendet" },
  "layout.color": { es: "Color", ca: "Color", en: "Color", de: "Farbe" },
  "layout.color.custom": { es: "Elegir otro color", ca: "Tria un altre color", en: "Pick another color", de: "Andere Farbe wählen" },
  "layout.up": { es: "Mover arriba", ca: "Mou amunt", en: "Move up", de: "Nach oben" },
  "layout.down": { es: "Mover abajo", ca: "Mou avall", en: "Move down", de: "Nach unten" },
  "param.edit": { es: "Editar parámetro", ca: "Edita el paràmetre", en: "Edit parameter", de: "Parameter bearbeiten" },

  "option.add": { es: "Añadir opción", ca: "Afegeix una opció", en: "Add option", de: "Option hinzufügen" },
  "option.label": { es: "Nombre de la opción", ca: "Nom de l'opció", en: "Option name", de: "Name der Option" },
  "option.placeholder": { es: "Opción", ca: "Opció", en: "Option", de: "Option" },
  "option.up": { es: "Subir opción", ca: "Puja l'opció", en: "Move option up", de: "Option nach oben" },
  "option.remove": { es: "Quitar opción", ca: "Treu l'opció", en: "Remove option", de: "Option entfernen" },

  /* Orden por lista de procedencia, requisitos en grupos y parámetro referente */
  "sort.source.order": { es: "Lista de origen (orden de las listas)", ca: "Llista d'origen (ordre de les llistes)", en: "Source list (order of the lists)", de: "Quellliste (Reihenfolge der Listen)" },
  "sort.source.name": { es: "Lista de origen (por nombre)", ca: "Llista d'origen (per nom)", en: "Source list (by name)", de: "Quellliste (nach Name)" },
  "dir.order.asc": { es: "Como en el menú", ca: "Com al menú", en: "As in the menu", de: "Wie im Menü" },
  "dir.order.desc": { es: "Al revés", ca: "Al revés", en: "Reversed", de: "Umgekehrt" },
  "req.all": { es: "Todas las condiciones (Y)", ca: "Totes les condicions (I)", en: "All conditions (AND)", de: "Alle Bedingungen (UND)" },
  "req.any": { es: "Alguna condición (O)", ca: "Alguna condició (O)", en: "Any condition (OR)", de: "Eine der Bedingungen (ODER)" },
  "req.within.label": { es: "En este grupo se cumplen", ca: "En aquest grup es compleixen", en: "In this group, meet", de: "In dieser Gruppe erfüllt" },
  "req.between.label": { es: "Entre grupos se cumplen", ca: "Entre grups es compleixen", en: "Between groups, meet", de: "Zwischen Gruppen erfüllt" },
  "req.between.all": { es: "Todos los grupos (Y)", ca: "Tots els grups (I)", en: "All groups (AND)", de: "Alle Gruppen (UND)" },
  "req.between.any": { es: "Algún grupo (O)", ca: "Algun grup (O)", en: "Any group (OR)", de: "Eine der Gruppen (ODER)" },
  "req.addGroup": { es: "Añadir grupo", ca: "Afegeix un grup", en: "Add group", de: "Gruppe hinzufügen" },
  "req.group": { es: "Grupo {n}", ca: "Grup {n}", en: "Group {n}", de: "Gruppe {n}" },
  "req.group.remove": { es: "Quitar grupo", ca: "Treu el grup", en: "Remove group", de: "Gruppe entfernen" },
  "link.match.label": { es: "Salen las tareas que cumplan", ca: "Surten les tasques que compleixin", en: "Show tasks that meet", de: "Aufgaben anzeigen, die erfüllen" },
  "ref.label": { es: "Parámetro referente", ca: "Paràmetre referent", en: "Reference parameter", de: "Referenzparameter" },
  "ref.hint": { es: "Es el que escribes en el recuadro de la lista y el que da nombre a cada tarea. Puede ser cualquier parámetro de texto.", ca: "És el que escrius al requadre de la llista i el que dona nom a cada tasca. Pot ser qualsevol paràmetre de text.", en: "It is what you type in the list box and what names each task. It can be any text parameter.", de: "Das ist, was du in das Feld der Liste schreibst und was jede Aufgabe benennt. Es kann jeder Textparameter sein." },
  "param.refBadge": { es: "referente", ca: "referent", en: "reference", de: "Referenz" },

  // --- Existentes ---
  "settings.about": {
    es: "Acerca de",
    ca: "Quant a",
    en: "About",
    de: "Über Flucti"
  },
  "about.title": {
    es: "Flucti",
    ca: "Flucti",
    en: "Flucti",
    de: "Flucti"
  },
  "about.description": {
    es: "Gestor de tareas minimalista, limpio y ordenado que adapta su aspecto al cielo real de tu ubicación.",
    ca: "Gestor de tasques minimalista, net i endreçat que adapta el seu aspecte al cel real de la teva ubicació.",
    en: "A minimalist, clean, and orderly task manager that adapts its look to the real sky at your location.",
    de: "Ein minimalistischer, sauberer und aufgeräumter Aufgabenmanager, der sein Aussehen an den echten Himmel an deinem Standort anpasst."
  },
  "about.whatIs.title": {
    es: "Qué es Flucti",
    ca: "Què és Flucti",
    en: "What Flucti is",
    de: "Was Flucti ist"
  },
  "about.whatIs.text": {
    es: "La pantalla de inicio muestra la hora con segundos, un saludo y la fecha sobre un fondo vivo que cambia con la hora, la época del año y el tiempo atmosférico. Al deslizar hacia abajo aparecen tus listas de tareas.",
    ca: "La pantalla d'inici mostra l'hora amb segons, una salutació i la data sobre un fons viu que canvia amb l'hora, l'època de l'any i el temps atmosfèric. En lliscar cap avall apareixen les teves llistes de tasques.",
    en: "The home screen shows the time with seconds, a greeting, and the date over a live background that changes with the time of day, season, and weather. Swipe down to reveal your task lists.",
    de: "Der Startbildschirm zeigt die Uhrzeit mit Sekunden, eine Begrüßung und das Datum vor einem lebendigen Hintergrund, der sich mit Tageszeit, Jahreszeit und Wetter verändert. Wische nach unten, um deine Aufgabenlisten zu öffnen."
  },
  "about.features.title": {
    es: "Qué hace",
    ca: "Què fa",
    en: "Features",
    de: "Funktionen"
  },
  "about.features.text": {
    es: "Organiza tareas únicas y recurrentes en listas personalizables, con orden inteligente por vencimiento y energía, parámetros a medida y cuatro idiomas.",
    ca: "Organitza tasques úniques i recurrents en llistes personalitzables, amb ordre intel·ligent per venciment i energia, paràmetres a mida i quatre idiomes.",
    en: "Organize one-off and recurring tasks in customizable lists, with smart sorting by due date and energy, custom parameters, and four languages.",
    de: "Organisiere einmalige und wiederkehrende Aufgaben in anpassbaren Listen – mit intelligenter Sortierung nach Fälligkeit und Energie, eigenen Parametern und vier Sprachen."
  },
  "about.future.title": {
    es: "En evolución",
    ca: "En evolució",
    en: "What's next",
    de: "Ausblick"
  },
  "about.future.text": {
    es: "Flucti crece manteniendo su esencia ligera y sin dependencias externas, cuidando cada detalle visual y protegiendo siempre tus datos locales.",
    ca: "Flucti creix mantenint la seva essència lleugera i sense dependències externes, cuidant cada detall visual i protegint sempre les teves dades locals.",
    en: "Flucti continues to grow while staying lightweight and free of external dependencies, refining every visual detail and always keeping your local data safe.",
    de: "Flucti entwickelt sich weiter und bleibt dabei leichtgewichtig und frei von externen Abhängigkeiten – mit Liebe zum visuellen Detail und vollem Schutz deiner lokalen Daten."
  },

  // --- Nuevos ---
  "about.badge": {
    es: "100 % en tu navegador · Sin cuentas",
    ca: "100 % al teu navegador · Sense comptes",
    en: "100% in your browser · No accounts",
    de: "100 % in deinem Browser · Ohne Konten"
  },
  "about.storage.text": {
    es: "No hay servidor ni registro: todas tus tareas se guardan en localStorage dentro de este dispositivo y navegador.",
    ca: "No hi ha servidor ni registre: totes les teves tasques es desen a localStorage dins d'aquest dispositiu i navegador.",
    en: "No server or sign-up required: all your tasks are stored in localStorage on this device and browser.",
    de: "Kein Server und keine Anmeldung: Alle deine Aufgaben werden im localStorage auf diesem Gerät und Browser gespeichert."
  },
  "about.features.sky.title": {
    es: "Cielo dinámico",
    ca: "Cel dinàmic",
    en: "Dynamic sky",
    de: "Dynamischer Himmel"
  },
  "about.features.sky.desc": {
    es: "Sigue la posición real del sol (hora azul, hora dorada, día y noche) y el clima: sol, nubes, lluvia, nieve, tormenta y niebla.",
    ca: "Segueix la posició real del sol (hora blava, hora daurada, dia i nit) i el clima: sol, núvols, pluja, neu, tempesta i boira.",
    en: "Follows the sun's real position (blue hour, golden hour, day, and night) and local weather: sun, clouds, rain, snow, storm, and fog.",
    de: "Folgt dem echten Sonnenstand (blaue Stunde, goldene Stunde, Tag und Nacht) sowie dem Wetter: Sonne, Wolken, Regen, Schnee, Gewitter und Nebel."
  },
  "about.features.lists.title": {
    es: "Listas a tu medida",
    ca: "Llistes a la teva mida",
    en: "Tailored lists",
    de: "Individuelle Listen"
  },
  "about.features.lists.desc": {
    es: "Crea, oculta, renombra o elimina listas. Cada una tiene su propio orden y decide si muestra las tareas completadas.",
    ca: "Crea, oculta, reanomena o elimina llistes. Cadascuna té el seu propi ordre i decideix si mostra les tasques completades.",
    en: "Create, hide, rename, or delete lists. Each list keeps its own sort order and chooses whether to show completed tasks.",
    de: "Erstelle, verberge, benenne um oder lösche Listen. Jede Liste hat ihre eigene Sortierung und entscheidet, ob erledigte Aufgaben angezeigt werden."
  },
  "about.features.tasks.title": {
    es: "Tareas únicas y recurrentes",
    ca: "Tasques úniques i recurrents",
    en: "One-off & recurring tasks",
    de: "Einmalige & wiederkehrende Aufgaben"
  },
  "about.features.tasks.desc": {
    es: "Añade vencimiento, planificación y nivel de energía. Las que vencen mañana se resaltan y las recurrentes avanzan solas al completarlas.",
    ca: "Afegeix venciment, planificació i nivell d'energia. Les que vencen demà es ressalten i les recurrents avancen soles en completar-les.",
    en: "Add due dates, planned dates, and energy levels. Tasks due tomorrow are highlighted, and recurring ones advance automatically when completed.",
    de: "Füge Fälligkeit, Planung und Energielevel hinzu. Morgen fällige Aufgaben werden hervorgehoben und wiederkehrende springen beim Abhaken weiter."
  },
  "about.features.params.title": {
    es: "Parámetros flexibles",
    ca: "Paràmetres flexibles",
    en: "Flexible parameters",
    de: "Flexible Parameter"
  },
  "about.features.params.desc": {
    es: "Configura campos obligatorios u opcionales y crea los tuyos propios (texto, número, fecha, lista o sí/no) sin perder datos al quitarlos.",
    ca: "Configura camps obligatoris o opcionals i crea els teus propis (text, número, data, llista o sí/no) sense perdre dades en treure'ls.",
    en: "Set required or optional fields and create your own (text, number, date, dropdown, or yes/no) without losing data if removed.",
    de: "Lege Pflicht- oder optionale Felder fest und erstelle eigene (Text, Zahl, Datum, Auswahl oder Ja/Nein), ohne Daten beim Entfernen zu verlieren."
  },
  "about.features.i18n.title": {
    es: "Cuatro idiomas",
    ca: "Quatre idiomes",
    en: "Four languages",
    de: "Vier Sprachen"
  },
  "about.features.i18n.desc": {
    es: "Disponible en español, catalán, inglés y alemán, con todos los textos centralizados en languages.js.",
    ca: "Disponible en espanyol, català, anglès i alemany, amb tots els textos centralitzats a languages.js.",
    en: "Available in Spanish, Catalan, English, and German, with all strings centralized in languages.js.",
    de: "Verfügbar auf Spanisch, Katalanisch, Englisch und Deutsch – alle Texte sind zentral in languages.js abgelegt."
  },
  "about.features.backups.title": {
    es: "Copias de seguridad",
    ca: "Còpies de seguretat",
    en: "Automatic backups",
    de: "Automatische Sicherungen"
  },
  "about.features.backups.desc": {
    es: "Las actualizaciones nunca borran tus tareas: antes de migrar datos se guarda una copia íntegra en el navegador.",
    ca: "Les actualitzacions mai esborren les teves tasques: abans de migrar dades es desa una còpia íntegra al navegador.",
    en: "Updates never erase your tasks: a full backup is saved in your browser before any data migration.",
    de: "Updates löschen niemals deine Aufgaben: Vor jeder Datenmigration wird eine vollständige Sicherung im Browser gespeichert."
  },
  "about.changelog.title": {
    es: "Registro de cambios",
    ca: "Registre de canvis",
    en: "Change log",
    de: "Änderungsprotokoll"
  },
  "about.changelog.subtitle": {
    es: "Registro de todas las versiones de Flucti",
    ca: "Registre de totes les versions de Flucti",
    en: "Complete changelog for all Flucti versions",
    de: "Vollständiges Änderungsprotokoll für alle Flucti-Versionen"
  },

  "about.versions.v001.label": {
    es: "v.0.1.0-alpha",
    ca: "v.0.1.0-alpha",
    en: "v.0.1.0-alpha",
    de: "v.0.1.0-alpha"
  },
  "about.versions.v001.date": {
    es: "02/11/2026",
    ca: "02/11/2026",
    en: "02/11/2026",
    de: "02/11/2026"
  },
  "about.versions.v001.title": {
    es: "Primera versión",
    ca: "Primera versió",
    en: "First version",
    de: "Erste Version"
  },
  "about.versions.v001.body": {
    es: "La primera versión del proyecto, con la hora, un fondo que cambia de color según la hora, un mensaje de saludo y una lista para poder agregar y completar tareas, únicamente con un campo de texto.",
    ca: "La primera versió del projecte, amb l'hora, un fons que canvia de color segons l'hora, un missatge de salutació i una llista per poder afegir i completar tasques, únicament amb un camp de text.",
    en: "The first version of the project, with the time, a background that changes color according to the time, a greeting message and a list to add and complete tasks, only with a text field.",
    de: "Die erste Version des Projekts, mit der Uhrzeit, einem Hintergrund, der sich entsprechend der Uhrzeit färbt, einer Begrüßungsnachricht und einer Liste zum Hinzufügen und Abschließen von Aufgaben, nur mit einem Textfeld."
  },

  "about.versions.v002.label": {
    es: "v.0.1.1-beta",
    ca: "v.0.1.1-beta",
    en: "v.0.1.1-beta",
    de: "v.0.1.1-beta"
  },
  "about.versions.v002.date": {
    es: "02/11/2026",
    ca: "02/11/2026",
    en: "02/11/2026",
    de: "02/11/2026"
  },
  "about.versions.v002.title": {
    es: "Meteorología avanzada, dinámica y exacta",
    ca: "Meteorologia avançada, dinàmica i exacta",
    en: "Advanced, dynamic and accurate weather",
    de: "Fortgeschritten, dynamisch und präzise Wetter"
  },
  "about.versions.v002.body": {
    es: "En esta versión el fondo cambia según la meteorología del lugar donde se encuentra el usuario, con muchas opciones (lluvia, nieve, tormenta, sol, nubes...). Además, las horas de sol se adaptan según la localización del usuario y hay diversas tonalidades del cielo.",
    ca: "En aquesta versió el fons canvia segons la meteorologia del lloc on es troba l'usuari, amb moltes opcions (pluja, neu, tempesta, sol, núvols...). A més, les hores de sol s'adapten segons la localització de l'usuari i hi ha diverses tonalitats del cel.",
    en: "In this version, the background changes according to the weather conditions of the location where the user is found, with many options (rain, snow, storm, sun, clouds...). Additionally, the hours of sunlight adapt according to the user's location and there are various sky tones.",
    de: "In dieser Version ändert sich der Hintergrund entsprechend den Wetterbedingungen des Ortes, an dem sich der Benutzer befindet, mit vielen Optionen (Regen, Schnee, Sturm, Sonne, Wolken...). Darüber hinaus passen die Sonnenstunden sich entsprechend der Standortbestimmung des Benutzers an und es gibt verschiedene Himmelsfarben."
  },

  "about.versions.v003.label": {
    es: "v.0.1.2-beta",
    ca: "v.0.1.2-beta",
    en: "v.0.1.2-beta",
    de: "v.0.1.2-beta"
  },
  "about.versions.v003.date": {
    es: "06/11/2026",
    ca: "06/11/2026",
    en: "06/11/2026",
    de: "06/11/2026"
  },
  "about.versions.v003.title": {
    es: "¡Idiomas!",
    ca: "Idiomes!",
    en: "Languages!",
    de: "Sprachen!"
  },
  "about.versions.v003.body": {
    es: "Se ha añadido la posibilidad de cambiar el idioma de la aplicación. Además, hay el botón del menú, y se ha mejorado el color del fondo según la hora del día.",
    ca: "S'ha afegit la possibilitat de canviar l'idioma de l'aplicació. A més, hi ha el botó del menú, i s'ha millorat el color del fons segons l'hora del dia.",
    en: "The ability to change the application language has been added. Additionally, there is a menu button, and the background color has been improved according to the time of day.",
    de: "Die Möglichkeit, die Sprache der Anwendung zu ändern, wurde hinzugefügt. Außerdem gibt es eine Menütaste, und die Hintergrundfarbe wurde entsprechend der Tageszeit verbessert."
  },

  "about.versions.v004.label": {
    es: "v.0.1.3-beta",
    ca: "v.0.1.3-beta",
    en: "v.0.1.3-beta",
    de: "v.0.1.3-beta"
  },
  "about.versions.v004.date": {
    es: "15/11/2026",
    ca: "15/11/2026",
    en: "15/11/2026",
    de: "15/11/2026"
  },
  "about.versions.v004.title": {
    es: "Tareas con parámetros",
    ca: "Tasques amb paràmetres",
    en: "Tasks with parameters",
    de: "Aufgaben mit Parametern"
  },
  "about.versions.v004.body": {
    es: "Ahora las tareas tienen parámetros. También puedes crear listas con configuraciones diferentes. Las tareas se ordenan automáticamente según sus parámetros. También puedes crear tareas recurrentes, que se repitan cada cierto tiempo.",
    ca: "Ara les tasques tenen paràmetres. També pots crear llistes amb configuracions diferents. Les tasques s'ordenen automàticament segons els seus paràmetres. També pots crear tasques recurrents, que es repeteixin cada cert temps.",
    en: "Now tasks have parameters. You can also create lists with different configurations. Tasks are automatically sorted according to their parameters. You can also create recurring tasks that repeat every so often.",
    de: "Die Möglichkeit, die Sprache der Anwendung zu ändern, wurde hinzugefügt. Außerdem gibt es eine Menütaste, und die Hintergrundfarbe wurde entsprechend der Tageszeit verbessert."
  },

  "about.versions.v005.label": {
    es: "v.0.1.4-beta",
    ca: "v.0.1.4-beta",
    en: "v.0.1.4-beta",
    de: "v.0.1.4-beta"
  },
  "about.versions.v005.date": {
    es: "19/11/2026",
    ca: "19/11/2026",
    en: "19/11/2026",
    de: "19/11/2026"
  },
  "about.versions.v005.title": {
    es: "Mejora de estilo y correción de errores",
    ca: "Millora d'estil i correcció d'errors",
    en: "Style improvement and error correction",
    de: "Stilverbesserung und Fehlerkorrektur"
  },
  "about.versions.v005.body": {
    es: "Se ha mejorado el estilo de la aplicación y se han corregido errores menores. Además, se ha añadido la sección 'sobre Flucti' con información sobre la aplicación y sus créditos.",
    ca: "S'ha millorat l'estil de l'aplicació i s'han corregit errors menors. A més, s'ha afegit la secció 'sobre Flucti' amb informació sobre l'aplicació i els seus crèdits.",
    en: "The app's style has been improved and minor errors have been fixed. Additionally, the 'About Flucti' section has been added with information about the application and its credits.",
    de: "Der Stil der Anwendung wurde verbessert und kleinere Fehler wurden behoben. Zudem wurde der Abschnitt 'Über Flucti' hinzugefügt, der Informationen über die Anwendung und ihre Urheber enthält."
  },

  "about.versions.v006.label": {
    es: "v.0.1.5-beta",
    ca: "v.0.1.5-beta",
    en: "v.0.1.5-beta",
    de: "v.0.1.5-beta"
  },
  "about.versions.v006.date": {
    es: "20/11/2026",
    ca: "20/11/2026",
    en: "20/11/2026",
    de: "20/11/2026"
  },
  "about.versions.v006.title": {
    es: "Parámetros personalizados por lista y mejora de su visualización",
    ca: "Paràmetres personalitzats per llista i millora de la seva visualització",
    en: "Custom parameters per list and improvement of their visualization",
    de: "Benutzerdefinierte Parameter je Liste und Verbesserung ihrer Darstellung"
  },
  "about.versions.v006.body": {
    es: "Ahora, cada lista puede tener sus propios parámetros personalizados y se ha mejorado la visualización de los mismos en la interfaz de usuario.",
    ca: "Ara, cada llista pot tenir els seus propis paràmetres personalitzats i s'ha millorat la visualització dels mateixos a la interfície d'usuari.",
    en: "Now, each list can have its own custom parameters and the visualization of these has been improved in the user interface.",
    de: "Jetzt kann jede Liste ihre eigenen benutzerdefinierten Parameter haben und die Darstellung dieser wurde in der Benutzeroberfläche verbessert."
  },

  "about.versions.v007.label": {
    es: "v.0.1.6-beta",
    ca: "v.0.1.6-beta",
    en: "v.0.1.6-beta",
    de: "v.0.1.6-beta"
  },
  "about.versions.v007.date": {
    es: "21/11/2026",
    ca: "21/11/2026",
    en: "21/11/2026",
    de: "21/11/2026"
  },
  "about.versions.v007.title": {
    es: "Movimiento de listas, resaltado de tareas y corrección de estilo y errores",
    ca: "Moviment de llistes, ressaltat de tasques i correcció d'estil i errors",
    en: "Moving lists, highlighting tasks, and style and error correction",
    de: "Verschieben von Listen, Hervorheben von Aufgaben und Stil- und Fehlerkorrektur"
  },
  "about.versions.v007.body": {
    es: "Ahora puedes mover libremente las listas por el menú principal y resaltar tareas en específico. También se han realizado mejoras en el estilo de la aplicación y se han corregido errores menores.",
    ca: "Ara pots moure lliurement les llistes pel menú principal i ressaltar tasques en específic. També s'han realitzat millores en l'estil de l'aplicació i s'han corregit errors menors.",
    en: "You can now move lists freely through the main menu and highlight specific tasks. Additionally, improvements have been made to the application's style and minor errors have been corrected.",
    de: "Jetzt kannst du Listen frei durch das Hauptmenü verschieben und bestimmte Aufgaben hervorheben. Außerdem wurden Verbesserungen am Stil der Anwendung vorgenommen und kleinere Fehler behoben."
  },

  "about.versions.v008.label": {
    es: "v.0.2.0-beta",
    ca: "v.0.2.0-beta",
    en: "v.0.2.0-beta",
    de: "v.0.2.0-beta"
  },
  "about.versions.v008.date": {
    es: "24/11/2026",
    ca: "24/11/2026",
    en: "24/11/2026",
    de: "24/11/2026"
  },
  "about.versions.v008.title": {
    es: "Listas dependientes, más parámetros, y mejora visual general",
    ca: "Llistes dependents, més paràmetres, i millora visual general",
    en: "Dependent lists, more parameters, and general visual improvement",
    de: "Abhängige Listen, mehr Parameter und allgemeine visuelle Verbesserung"
  },
  "about.versions.v008.body": {
    es: "Esta es una actualización que trae cambios importantes. Introduce el concepto de listas dependientes y permite más parámetros personalizados, como lista de procedencia, requisitos en grupos así cómo la agrupación de los parámetros en grupos paramétricos y parámetro referente. Además, se ha mejorado la visualización de la aplicación en general, y se han solucionado inumerables errores menores.",
    ca: "Aquesta és una actualització que porta canvis importants. Introduïx el concepte de llistes dependents i permet més paràmetres personalitzats, com llista de procedència, requisits en grups així com l'agrupació dels paràmetres en grups paramètrics i paràmetre referent. A més, s'ha millorat la visualització de l'aplicació en general, i s'han solucionat innombrables errors menors.",
    en: "This is an update that brings important changes. It introduces the concept of dependent lists and allows for more customized parameters, such as source lists, requirements in groups, as well as the grouping of parameters into parametric groups and reference parameters. Additionally, the visualization of the application has been improved in general, and numerous minor errors have been fixed.",
    de: "Dies ist ein Update, das wichtige Änderungen mit sich bringt. Es führt das Konzept abhängiger Listen ein und ermöglicht mehr benutzerdefinierte Parameter, wie z.B. Quelllisten, Anforderungen in Gruppen sowie die Gruppierung der Parameter in parametrischen Gruppen und Bezugspunkte. Darüber hinaus wurde die Darstellung der Anwendung im Allgemeinen verbessert, und zahlreiche kleinere Fehler wurden behoben."
  },

"about.me.title": {
    es: "¿Quién soy?",
    ca: "Qui soc?",
    en: "Who am I?",
    de: "Wer bin ich?"
  },
  "about.me.description": {
    es: "Hola, me llamo Sergi Ventosa y soy el desarrollador de Flucti. Soy un joven programador que ha creado esta aplicación por necesidad personal y para ayudar a la gente en la gestión de sus tareas. Me apasiona la programación y siempre estoy buscando mejorar mis habilidades y aprender nuevas tecnologías. Espero que disfrutes usando Flucti tanto como he disfrutado creándola.",
    ca: "Hola, em dic Sergi Ventosa i soc el desenvolupador de Flucti. Soc un jove programador que ha creat aquesta aplicació per necessitat personal i per ajudar a la gent en la gestió de les seves tasques. M'encanta la programació i sempre estic buscant millorar les meves habilitats i aprendre noves tecnologies. Espero que gaudeixis utilitzant Flucti tant com jo he gaudit creant-lo.",
    en: "Hello, I'm Sergi Ventosa and I'm the developer of Flucti. I'm a young programmer who created this application out of personal need and to help people manage their tasks. I'm passionate about programming and always look for ways to improve my skills and learn new technologies. I hope you enjoy using Flucti as much as I've enjoyed creating it.",
    de: "Hallo, ich bin Sergi Ventosa und ich bin der Entwickler von Flucti. Ich bin ein junger Programmierer, der diese Anwendung aus persönlichen Bedürfnissen und um anderen zu helfen, ihre Aufgaben zu verwalten, erstellt hat. Ich liebe Programmierung und suche immer nach Möglichkeiten, meine Fähigkeiten zu verbessern und neue Technologien zu lernen. Ich hoffe, Sie genießen Flucti genauso sehr wie ich es beim Erstellen genieße."
  },
  "about.me.contact": {
    es: "Para dudas o sugerencias, escríbeme en servenord2@gmail.com.",
    ca: "Per a preguntes o suggeriments, escriu-me a servenord2@gmail.com.",
    en: "For questions or suggestions, feel free to contact me at servenord2@gmail.com.",
    de: "Für Fragen oder Vorschläge können Sie mich unter servenord2@gmail.com erreichen."
  },
  "about.credits.title": {
    es: "Créditos y datos técnicos",
    ca: "Crèdits i dades tècniques",
    en: "Credits & technical notes",
    de: "Quellen & technische Hinweise"
  },
  "about.credits.weather": {
    es: "Datos meteorológicos proporcionados por Open-Meteo (licencia CC BY 4.0).",
    ca: "Dades meteorològiques proporcionades per Open-Meteo (llicència CC BY 4.0).",
    en: "Weather data provided by Open-Meteo (CC BY 4.0 license).",
    de: "Wetterdaten bereitgestellt von Open-Meteo (CC BY 4.0-Lizenz)."
  },
  "about.credits.font": {
    es: "Tipografía Manrope (SIL Open Font License) servida mediante Google Fonts.",
    ca: "Tipografia Manrope (SIL Open Font License) servida mitjançant Google Fonts.",
    en: "Manrope typeface (SIL Open Font License) served via Google Fonts.",
    de: "Schriftart Manrope (SIL Open Font License), bereitgestellt über Google Fonts."
  },
  "about.credits.defaultLocation": {
    es: "Si el navegador bloquea la ubicación o abres el archivo directamente, Flucti usa Igualada como ubicación por defecto.",
    ca: "Si el navegador bloca la ubicació o obres el fitxer directament, Flucti fa servir Igualada com a ubicació per defecte.",
    en: "If your browser blocks location access or you open the file directly, Flucti defaults to Igualada.",
    de: "Wenn der Browser den Standort blockiert oder die Datei direkt geöffnet wird, verwendet Flucti standardmäßig Igualada."
  }



};

// Aviso en la consola si falta alguna traducción (útil al editar a mano).
for (const [key, texts] of Object.entries(TRANSLATIONS)) {
  for (const { code } of LANGUAGES) {
    if (typeof texts[code] !== "string" || texts[code] === "") {
      console.warn(`languages.js: falta la traducción "${code}" de "${key}".`);
    }
  }
}