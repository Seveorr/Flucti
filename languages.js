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
  "login.label": { es: "Iniciar sesión", ca: "Inicia la sessió", en: "Sign in", de: "Anmelden" },
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

  /* Menú: opciones de cuenta */
  "menu.switchAccount": { es: "Cambiar de cuenta", ca: "Canvia de compte", en: "Switch account", de: "Konto wechseln" },
  "menu.signOut": { es: "Cerrar sesión", ca: "Tanca la sessió", en: "Sign out", de: "Abmelden" },

  /* Inicio de sesión y cuentas */
  "login.text": {
    es: "Inicia sesión para continuar",
    ca: "Inicia la sessió per continuar",
    en: "Sign in to continue",
    de: "Melde dich an, um fortzufahren",
  },
  "login.textRegister": {
    es: "Crea tu cuenta para continuar",
    ca: "Crea el teu compte per continuar",
    en: "Create your account to continue",
    de: "Erstelle dein Konto, um fortzufahren",
  },
  "login.email": { es: "Correo electrónico", ca: "Correu electrònic", en: "Email", de: "E-Mail" },
  "login.password": { es: "Contraseña", ca: "Contrasenya", en: "Password", de: "Passwort" },
  "login.confirm": {
    es: "Repite la contraseña",
    ca: "Repeteix la contrasenya",
    en: "Repeat password",
    de: "Passwort wiederholen",
  },
  "login.signIn": { es: "Iniciar sesión", ca: "Inicia la sessió", en: "Sign in", de: "Anmelden" },
  "login.register": { es: "Crear cuenta", ca: "Crea el compte", en: "Create account", de: "Konto erstellen" },
  "login.toRegister": {
    es: "¿No tienes cuenta? Crear cuenta",
    ca: "No tens compte? Crea'n un",
    en: "No account yet? Create one",
    de: "Noch kein Konto? Jetzt erstellen",
  },
  "login.toSignIn": {
    es: "¿Ya tienes cuenta? Iniciar sesión",
    ca: "Ja tens compte? Inicia la sessió",
    en: "Already have an account? Sign in",
    de: "Schon ein Konto? Anmelden",
  },
  "login.back": { es: "Volver", ca: "Torna", en: "Back", de: "Zurück" },
  "login.dev": {
    es: "Entrar en modo de desarrollo",
    ca: "Entra en mode de desenvolupament",
    en: "Continue in development mode",
    de: "Im Entwicklungsmodus fortfahren",
  },
  "login.noServer": {
    es: "No hay servidor configurado: la app funciona solo en este dispositivo.",
    ca: "No hi ha cap servidor configurat: l'aplicació funciona només en aquest dispositiu.",
    en: "No server is set up: the app works on this device only.",
    de: "Es ist kein Server eingerichtet: Die App funktioniert nur auf diesem Gerät.",
  },
  "login.fileProtocol": {
    es: "Para iniciar sesión, abre la app desde https o desde localhost, no como archivo.",
    ca: "Per iniciar la sessió, obre l'aplicació des d'https o des de localhost, no com a arxiu.",
    en: "To sign in, open the app from https or localhost, not as a file.",
    de: "Zum Anmelden öffne die App über https oder localhost, nicht als Datei.",
  },
  "login.expired": {
    es: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
    ca: "La teva sessió ha caducat. Torna a iniciar la sessió.",
    en: "Your session has expired. Please sign in again.",
    de: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
  },
  "login.error.credentials": {
    es: "Correo o contraseña incorrectos.",
    ca: "Correu o contrasenya incorrectes.",
    en: "Incorrect email or password.",
    de: "E-Mail oder Passwort falsch.",
  },
  "login.error.emailTaken": {
    es: "Ya existe una cuenta con ese correo.",
    ca: "Ja existeix un compte amb aquest correu.",
    en: "An account with this email already exists.",
    de: "Es gibt bereits ein Konto mit dieser E-Mail.",
  },
  "login.error.tooMany": {
    es: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
    ca: "Massa intents. Espera uns minuts i torna-ho a provar.",
    en: "Too many attempts. Wait a few minutes and try again.",
    de: "Zu viele Versuche. Warte ein paar Minuten und versuche es erneut.",
  },
  "login.error.invalidEmail": {
    es: "Escribe un correo electrónico válido.",
    ca: "Escriu un correu electrònic vàlid.",
    en: "Enter a valid email address.",
    de: "Gib eine gültige E-Mail-Adresse ein.",
  },
  "login.error.weakPassword": {
    es: "La contraseña debe tener al menos 8 caracteres.",
    ca: "La contrasenya ha de tenir almenys 8 caràcters.",
    en: "The password must have at least 8 characters.",
    de: "Das Passwort muss mindestens 8 Zeichen haben.",
  },
  "login.error.passwordTooLong": {
    es: "La contraseña es demasiado larga (máximo unos 72 caracteres).",
    ca: "La contrasenya és massa llarga (màxim uns 72 caràcters).",
    en: "The password is too long (about 72 characters at most).",
    de: "Das Passwort ist zu lang (höchstens etwa 72 Zeichen).",
  },
  "login.error.mismatch": {
    es: "Las contraseñas no coinciden.",
    ca: "Les contrasenyes no coincideixen.",
    en: "The passwords don't match.",
    de: "Die Passwörter stimmen nicht überein.",
  },
  "login.error.network": {
    es: "No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.",
    ca: "No s'ha pogut connectar amb el servidor. Comprova la connexió i torna-ho a provar.",
    en: "Couldn't reach the server. Check your connection and try again.",
    de: "Der Server ist nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.",
  },
  "login.error.server": {
    es: "El servidor no respondió correctamente. Inténtalo más tarde.",
    ca: "El servidor no ha respost correctament. Torna-ho a provar més tard.",
    en: "The server didn't respond correctly. Please try again later.",
    de: "Der Server hat nicht richtig geantwortet. Bitte versuche es später erneut.",
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