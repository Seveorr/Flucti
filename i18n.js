"use strict";

/* ==========================================================================
   i18n.js — lógica de idiomas y utilidades comunes (las traducciones están en languages.js)

   - Flucti: espacio común de la app (hora actual, ventanas, enlace entre archivos).
   - I18n:   idioma actual, función t() y actualización de los textos del HTML.
   ========================================================================== */

const Flucti = {
  now: () => new Date(), // "ahora": script.js lo sustituye para poder probar horas con testSky
  goToTasks: () => {}, // script.js lo conecta con el desplazamiento a la pantalla de tareas
  openDialogs: new Set(),

  isDialogOpen() {
    return Flucti.openDialogs.size > 0;
  },

  // Abre una ventana (<dialog>) delante de todo y bloquea el desplazamiento de la página.
  openDialog(dialog) {
    Flucti.openDialogs.add(dialog);
    document.documentElement.classList.add("modal-open");
    dialog.showModal();
  },

  // Sigue si la ventana está abierta y permite cerrarla pulsando fuera del contenido.
  bindDialog(dialog, onBackdrop) {
    dialog.addEventListener("close", () => {
      Flucti.openDialogs.delete(dialog);
      if (!Flucti.openDialogs.size) document.documentElement.classList.remove("modal-open");
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) (onBackdrop || (() => dialog.close()))();
    });
  },
};

const I18n = (() => {
  const LANGUAGE_KEY = "language:v1";
  const listeners = [];

  function detect() {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY);
      if (LANGUAGES.some((l) => l.code === saved)) return saved;
    } catch {
      /* se ignora */
    }
    const browser = (navigator.language || "").slice(0, 2).toLowerCase();
    return LANGUAGES.some((l) => l.code === browser) ? browser : LANGUAGES[0].code;
  }

  let language = detect();
  const current = () => LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  // Devuelve el texto de una clave en el idioma actual (o en el primero de la lista si falta).
  function t(key, params) {
    const entry = TRANSLATIONS[key];
    let text = (entry && (entry[language] || entry[LANGUAGES[0].code])) || key;
    if (params) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, value);
    return text;
  }

  // Textos con singular y plural: usa las claves "<clave>.one" y "<clave>.other".
  const tn = (key, count, params) => t(`${key}.${count === 1 ? "one" : "other"}`, params);

  // Actualiza los textos fijos del HTML (data-i18n, data-i18n-aria-label y data-i18n-placeholder).
  function apply() {
    const lang = current();
    document.documentElement.lang = lang.code;
    document.title = t("app.title");

    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel)));
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder)));

    document.querySelectorAll(".language-code").forEach((el) => (el.textContent = lang.label));
    document.querySelectorAll("[data-language-toggle]").forEach((button) => {
      button.setAttribute("aria-label", t("language.change", { language: lang.name }));
    });
  }

  function set(code) {
    language = code;
    try {
      localStorage.setItem(LANGUAGE_KEY, code);
    } catch {
      /* Sin almacenamiento disponible */
    }
    apply();
    listeners.forEach((listener) => listener());
  }

  // Pasa al siguiente idioma de la lista (botón de idioma).
  function next() {
    set(LANGUAGES[(LANGUAGES.indexOf(current()) + 1) % LANGUAGES.length].code);
  }

  // Avisa cuando cambia el idioma, para volver a dibujar lo que se genera con JavaScript.
  const onChange = (listener) => listeners.push(listener);

  function init() {
    document.querySelectorAll("[data-language-toggle]").forEach((button) => button.addEventListener("click", next));
    apply();
  }

  return { t, tn, current, set, apply, onChange, init };
})();