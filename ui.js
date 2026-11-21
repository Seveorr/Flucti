"use strict";

/* ==========================================================================
   ui.js — componentes de interfaz propios (con el aspecto de la app en todos los navegadores)

   h()           crea elementos del DOM        icon()        iconos
   dates         utilidades de fechas          segmented()   deslizador de varias opciones
   dropdown()    lista desplegable             datePicker()  selector de día
   timePicker()  selector de hora (reloj)      richEditor()  texto enriquecido (negrita, cursiva, listas)
   ========================================================================== */
const UI = (() => {
  const PROPS = new Set(["value", "checked", "disabled", "hidden", "selected"]);

  // h("div", { class: "x", onclick: fn }, hijo1, [hijo2, hijo3]) → elemento del DOM
  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "class") el.className = value;
      else if (key === "text") el.textContent = value;
      else if (key === "html") el.innerHTML = value;
      else if (key === "dataset") Object.assign(el.dataset, value);
      else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
      else if (PROPS.has(key)) el[key] = value;
      else el.setAttribute(key, value === true ? "" : String(value));
    }
    for (const child of children.flat()) {
      if (child !== null && child !== undefined && child !== false) el.append(child);
    }
    return el;
  }

  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    repeat: '<path d="M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    listBullet: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    listNumber: '<path d="M10 6h10M10 12h10M10 18h10M4 4.5l1.5-1V9M3.5 14h3l-3 3.5h3"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.6C3.6 8.4 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 4.1-.9"/>',
  };

  const icon = (name, size = 20) =>
    h("span", {
      class: "icon",
      "aria-hidden": "true",
      html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`,
    });

  const uid = () =>
    window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const clone = (value) => JSON.parse(JSON.stringify(value));

  /* ------------------------------------------------------------------------
     Fechas ("AAAA-MM-DD" como texto, en hora local)
     ------------------------------------------------------------------------ */
  const pad2 = (n) => String(n).padStart(2, "0");
  const toDateString = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  function parseDateString(text) {
    const [y, m, d] = text.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function dayNumber(text) {
    const [y, m, d] = text.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  }

  const diffDays = (text, base) => dayNumber(text) - dayNumber(base);
  const todayString = () => toDateString(Flucti.now());

  function addDays(text, n) {
    const d = parseDateString(text);
    d.setDate(d.getDate() + n);
    return toDateString(d);
  }

  // Suma meses sin salirse del mes (31 de enero + 1 mes = 28 o 29 de febrero).
  function addMonths(text, n) {
    const [, , day] = text.split("-").map(Number);
    const first = parseDateString(text);
    first.setDate(1);
    first.setMonth(first.getMonth() + n);
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    first.setDate(Math.min(day, lastDay));
    return toDateString(first);
  }

  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes primero (0 = domingo)

  // Nombre de un día de la semana (0 = domingo) en el idioma actual: "short" (lun.) o "narrow" (L).
  function weekdayName(day, width = "short") {
    return new Intl.DateTimeFormat(I18n.current().locale, { weekday: width }).format(new Date(2021, 0, 3 + day));
  }

  const dates = { pad2, toDateString, parseDateString, dayNumber, diffDays, todayString, addDays, addMonths, WEEK_ORDER, weekdayName };

  /* ------------------------------------------------------------------------
     Deslizador de varias opciones (tipo de tarea, tipo de repetición)
     ------------------------------------------------------------------------ */
  function segmented({ label, options, value, onChange }) {
    const root = h("div", { class: "segmented", role: "radiogroup", "aria-label": label });
    root.style.setProperty("--count", String(options.length));
    const buttons = [];
    const paint = (index) => {
      root.style.setProperty("--index", String(index));
      buttons.forEach((button, i) => button.setAttribute("aria-checked", String(i === index)));
    };
    root.append(h("span", { class: "segmented-thumb", "aria-hidden": "true" }));
    options.forEach((option, index) => {
      const button = h("button", {
        type: "button",
        role: "radio",
        class: "segmented-option",
        text: option.label,
        onclick: () => {
          paint(index);
          onChange(option.value);
        },
      });
      buttons.push(button);
      root.append(button);
    });
    paint(Math.max(0, options.findIndex((o) => o.value === value)));
    return root;
  }

  /* ------------------------------------------------------------------------
     Ventanas emergentes (desplegables, calendario, hora): solo hay una abierta a la vez
     ------------------------------------------------------------------------ */
  let active = null; // { root, panel, button }

  function closePopover(refocus = false) {
    if (!active) return;
    const { root, panel, button } = active;
    active = null;
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    root.classList.remove("is-open");
    if (refocus) button.focus();
  }

  // Se cierra al pulsar fuera y al cerrarse la ventana que lo contiene.
  document.addEventListener("pointerdown", (event) => {
    if (active && !active.root.contains(event.target)) closePopover();
  }, true);
  document.addEventListener("close", () => closePopover(), true);

  function makePopover(root, button, panel, onOpen) {
    const open = () => {
      if (active && active.root !== root) closePopover();
      panel.hidden = false;
      panel.classList.remove("up");
      button.setAttribute("aria-expanded", "true");
      root.classList.add("is-open");
      active = { root, panel, button };
      // si no cabe por debajo, se abre hacia arriba
      const rect = panel.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 8 && button.getBoundingClientRect().top > rect.height) panel.classList.add("up");
      if (onOpen) onOpen();
    };
    button.addEventListener("click", () => (active && active.root === root ? closePopover() : open()));
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && active && active.root === root) {
        event.preventDefault(); // no cierra además la ventana de debajo
        event.stopPropagation();
        closePopover(true);
      }
    });
    return { open, close: () => active && active.root === root && closePopover() };
  }

  /* ------------------------------------------------------------------------
     Lista desplegable: dropdown({ value, options: [{ value, label, color? }], onChange, label })
     ------------------------------------------------------------------------ */
  function dropdown({ value, options, onChange, label }) {
    const root = h("div", { class: "dropdown" });
    const text = h("span", { class: "dropdown-text" });
    const dot = h("span", { class: "option-dot", hidden: true }); // color de la opción elegida (si la tiene)
    const button = h(
      "button",
      { type: "button", class: "field dropdown-button", "aria-haspopup": "listbox", "aria-expanded": "false", "aria-label": label },
      dot,
      text,
      icon("chevronDown", 16)
    );
    const panel = h("div", { class: "popover dropdown-panel", role: "listbox", hidden: true });
    let current = value;

    const choices = options.map((option) =>
      h("button", {
        type: "button",
        role: "option",
        class: "dropdown-option",
        onclick: () => {
          pick(option.value);
          pop.close();
          button.focus();
        },
      }, option.color ? h("span", { class: "option-dot", style: `--dot:${option.color}` }) : null, option.label)
    );

    function paint() {
      const selected = options.find((o) => o.value === current) || options[0];
      text.textContent = selected ? selected.label : "";
      dot.hidden = !(selected && selected.color);
      if (selected && selected.color) dot.style.setProperty("--dot", selected.color);
      choices.forEach((choice, i) => {
        const on = options[i].value === current;
        choice.setAttribute("aria-selected", String(on));
        choice.classList.toggle("is-selected", on);
      });
    }

    function pick(next) {
      if (next === current) return;
      current = next;
      paint();
      if (onChange) onChange(next);
    }

    panel.append(...choices);
    panel.addEventListener("keydown", (event) => {
      const i = choices.indexOf(event.target);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = choices[(i + (event.key === "ArrowDown" ? 1 : choices.length - 1)) % choices.length];
        if (next) next.focus();
      }
    });
    root.append(button, panel);
    const pop = makePopover(root, button, panel, () => {
      const selected = choices.find((c) => c.getAttribute("aria-selected") === "true") || choices[0];
      if (selected) selected.focus();
    });
    paint();
    root.dropdown = { get value() { return current; }, set: (v) => { current = v; paint(); } };
    return root;
  }

  /* ------------------------------------------------------------------------
     Selector de día: datePicker({ value: "AAAA-MM-DD" o "", onChange, label, placeholder })
     ------------------------------------------------------------------------ */
  function datePicker({ value, onChange, label, placeholder }) {
    let current = value || "";
    let view = (current || todayString()).slice(0, 7) + "-01"; // primer día del mes que se ve
    const root = h("div", { class: "picker" });
    const text = h("span", { class: "picker-text" });
    const button = h("button", { type: "button", class: "field picker-button", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-label": label }, icon("calendar", 16), text);
    const panel = h("div", { class: "popover calendar", role: "dialog", "aria-label": label, hidden: true });

    function paintButton() {
      const locale = I18n.current().locale;
      text.textContent = current
        ? new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(parseDateString(current))
        : placeholder;
      text.classList.toggle("is-placeholder", !current);
    }

    function set(next, notify) {
      current = next;
      paintButton();
      if (notify && onChange) onChange(next);
    }

    function renderPanel() {
      const locale = I18n.current().locale;
      const first = parseDateString(view);
      const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      const blanks = (first.getDay() + 6) % 7; // lunes primero
      const trailing = (7 - ((blanks + total) % 7)) % 7; // días que completan la última semana
      const today = todayString();
      const month = view.slice(0, 7);
      const cells = [];
      // También salen los días del mes anterior y posterior que caen en la primera y la última semana (más claros).
      for (let i = -blanks; i < total + trailing; i++) {
        const date = addDays(view, i);
        const outside = date.slice(0, 7) !== month;
        cells.push(
          h("button", {
            type: "button",
            class: `cal-day${outside ? " is-outside" : ""}${date === current ? " is-selected" : ""}${date === today ? " is-today" : ""}`,
            "aria-pressed": String(date === current),
            "aria-label": new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(parseDateString(date)),
            text: String(parseDateString(date).getDate()),
            onclick: () => {
              set(date, true);
              pop.close();
              button.focus();
            },
          })
        );
      }
      const shift = (n) => {
        view = addMonths(view, n);
        renderPanel();
      };
      panel.replaceChildren(
        h(
          "div",
          { class: "cal-head" },
          h("button", { type: "button", class: "icon-btn small", "aria-label": I18n.t("cal.prev"), onclick: () => shift(-1) }, icon("chevronLeft", 16)),
          h("strong", { class: "cal-title", text: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(first) }),
          h("button", { type: "button", class: "icon-btn small", "aria-label": I18n.t("cal.next"), onclick: () => shift(1) }, icon("chevron", 16))
        ),
        h("div", { class: "cal-weekdays" }, dates.WEEK_ORDER.map((d) => h("span", { text: weekdayName(d, "narrow") }))),
        h("div", { class: "cal-grid" }, cells),
        h("button", {
          type: "button",
          class: "cal-today",
          text: I18n.t("due.today"),
          onclick: () => {
            set(today, true);
            pop.close();
            button.focus();
          },
        })
      );
    }

    root.append(button, panel);
    const pop = makePopover(root, button, panel, () => {
      view = (current || todayString()).slice(0, 7) + "-01";
      renderPanel();
    });
    paintButton();
    root.picker = { get value() { return current; }, set: (v) => set(v, false), repaint: paintButton };
    return root;
  }

  /* ------------------------------------------------------------------------
     Selector de hora: timePicker({ value: "HH:MM" o "", onChange, label, placeholder, disabled })
     Un reloj: primero se elige la hora (anillo exterior 1-12, interior 13-23 y 00) y luego los minutos.
     Se puede pulsar o arrastrar; con el teclado, las flechas ajustan el valor y Enter confirma.
     ------------------------------------------------------------------------ */
  const SVG_NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs = {}) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    return el;
  };
  const DIAL = { center: 100, outer: 78, inner: 50 };
  const dialPoint = (degrees, radius) => [
    DIAL.center + radius * Math.sin((degrees * Math.PI) / 180),
    DIAL.center - radius * Math.cos((degrees * Math.PI) / 180),
  ];

  function timePicker({ value, onChange, label, placeholder, disabled }) {
    let current = value || "";
    let mode = "hour"; // "hour" o "minute"
    const root = h("div", { class: "picker picker-time" });
    const text = h("span", { class: "picker-text" });
    const button = h("button", { type: "button", class: "field picker-button", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-label": label, disabled: Boolean(disabled) }, icon("clock", 16), text);
    const panel = h("div", { class: "popover time-panel", role: "dialog", "aria-label": label, hidden: true });

    const hourSeg = h("button", { type: "button", class: "time-seg", "aria-label": I18n.t("time.hour"), onclick: () => setMode("hour") });
    const minuteSeg = h("button", { type: "button", class: "time-seg", "aria-label": I18n.t("time.minute"), onclick: () => setMode("minute") });
    const head = h("div", { class: "time-head" }, hourSeg, h("span", { text: ":" }), minuteSeg);

    const svg = svgEl("svg", { viewBox: "0 0 200 200", class: "dial", role: "slider", tabindex: "0", "aria-label": label });
    const hand = svgEl("line", { class: "dial-hand", x1: 100, y1: 100 });
    const knob = svgEl("circle", { class: "dial-knob" });
    const labels = svgEl("g");
    svg.append(svgEl("circle", { class: "dial-face", cx: 100, cy: 100, r: 96 }), hand, knob, labels);

    const parts = () => {
      const [hh, mm] = current ? current.split(":").map(Number) : [null, null];
      return { hh, mm };
    };

    function paint() {
      text.textContent = current || placeholder;
      text.classList.toggle("is-placeholder", !current);
      const { hh, mm } = parts();
      hourSeg.textContent = hh === null ? "--" : pad2(hh);
      minuteSeg.textContent = mm === null ? "--" : pad2(mm);
      hourSeg.classList.toggle("is-active", mode === "hour");
      minuteSeg.classList.toggle("is-active", mode === "minute");

      labels.replaceChildren();
      let selected = null; // { x, y, small, label }
      const addLabel = (content, angle, radius, inner, isSelected) => {
        const [x, y] = dialPoint(angle, radius);
        const node = svgEl("text", { class: `dial-label${inner ? " inner" : ""}${isSelected ? " is-selected" : ""}`, x, y });
        node.textContent = content;
        labels.append(node);
        return [x, y];
      };

      if (mode === "hour") {
        const k = hh === null ? -1 : hh % 12; // posición en la esfera (0 = arriba)
        const isInner = hh === 0 || (hh !== null && hh > 12);
        for (let i = 0; i < 12; i++) {
          addLabel(String(i === 0 ? 12 : i), i * 30, DIAL.outer, false, hh !== null && !isInner && k === i);
          addLabel(pad2(i === 0 ? 0 : 12 + i), i * 30, DIAL.inner, true, hh !== null && isInner && k === i);
        }
        if (hh !== null) selected = { point: dialPoint(k * 30, isInner ? DIAL.inner : DIAL.outer), small: false };
      } else {
        for (let i = 0; i < 12; i++) addLabel(pad2(i * 5), i * 30, DIAL.outer, false, mm !== null && mm === i * 5);
        if (mm !== null) selected = { point: dialPoint(mm * 6, DIAL.outer), small: mm % 5 !== 0 };
      }

      hand.style.display = knob.style.display = selected ? "" : "none";
      if (selected) {
        const [x, y] = selected.point;
        hand.setAttribute("x2", x);
        hand.setAttribute("y2", y);
        knob.setAttribute("cx", x);
        knob.setAttribute("cy", y);
        knob.setAttribute("r", selected.small ? 5 : 16);
        svg.setAttribute("aria-valuetext", current);
      }
    }

    function setMode(next) {
      mode = next;
      paint();
    }

    // Al elegir la hora, los minutos se quedan como estaban (o en punto).
    function pick(hour, minute) {
      const { hh, mm } = parts();
      current = `${hour ?? pad2(hh ?? 9)}:${minute ?? pad2(mm ?? 0)}`;
      paint();
      if (onChange) onChange(current);
    }

    function finishStep() {
      if (mode === "hour") setMode("minute");
      else {
        pop.close();
        button.focus();
      }
    }

    // Posición del puntero respecto al centro: ángulo en grados (0 = arriba, en sentido horario) y distancia.
    function fromPointer(event) {
      const rect = svg.getBoundingClientRect();
      const scale = 200 / rect.width;
      const x = (event.clientX - rect.left) * scale - DIAL.center;
      const y = (event.clientY - rect.top) * scale - DIAL.center;
      return { angle: ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360, radius: Math.hypot(x, y) };
    }

    function apply(event) {
      const { angle, radius } = fromPointer(event);
      if (mode === "hour") {
        const k = Math.round(angle / 30) % 12;
        const inner = radius < (DIAL.outer + DIAL.inner) / 2;
        pick(pad2(inner ? (k === 0 ? 0 : 12 + k) : k === 0 ? 12 : k), null);
      } else {
        pick(null, pad2(Math.round(angle / 6) % 60));
      }
    }

    let dragging = false;
    svg.addEventListener("pointerdown", (event) => {
      dragging = true;
      svg.setPointerCapture(event.pointerId);
      apply(event);
    });
    svg.addEventListener("pointermove", (event) => {
      if (dragging) apply(event);
    });
    const release = () => {
      if (!dragging) return;
      dragging = false;
      finishStep();
    };
    svg.addEventListener("pointerup", release);
    svg.addEventListener("pointercancel", () => (dragging = false));
    svg.addEventListener("keydown", (event) => {
      const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[event.key];
      if (step) {
        event.preventDefault();
        const { hh, mm } = parts();
        if (mode === "hour") pick(pad2((((hh ?? 9) + step) % 24 + 24) % 24), null);
        else pick(null, pad2((((mm ?? 0) + step) % 60 + 60) % 60));
      } else if (event.key === "Enter") {
        event.preventDefault();
        finishStep();
      }
    });

    panel.append(head, svg);
    root.append(button, panel);
    const pop = makePopover(root, button, panel, () => setMode("hour"));
    paint();
    root.picker = {
      get value() { return current; },
      set: (v) => { current = v || ""; paint(); },
      setDisabled: (isDisabled) => { button.disabled = isDisabled; if (isDisabled) pop.close(); },
    };
    return root;
  }

  /* ------------------------------------------------------------------------
     Texto enriquecido (descripciones y campos de texto largo)
     Se guarda como HTML limpio: solo negrita, cursiva, tachado, subrayado y listas.
     Los textos antiguos (texto plano) se leen igual, con sus saltos de línea.
     ------------------------------------------------------------------------ */
  const RICH_TAGS = { B: "strong", STRONG: "strong", I: "em", EM: "em", U: "u", S: "s", STRIKE: "s", DEL: "s", UL: "ul", OL: "ol", LI: "li", BR: "br", DIV: "div", P: "div" };
  const RICH_DETECT = /<\/?(strong|em|b|i|u|s|ul|ol|li|br|div|p|strike|del)\b[^>]*>/i;
  const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function copyAllowed(source, target) {
    for (const node of source.childNodes) {
      if (node.nodeType === 3) {
        target.append(document.createTextNode(node.nodeValue));
      } else if (node.nodeType === 1) {
        const tag = RICH_TAGS[node.tagName];
        if (tag) {
          const el = document.createElement(tag);
          if (tag !== "br") copyAllowed(node, el);
          target.append(el);
        } else if (node.tagName !== "SCRIPT" && node.tagName !== "STYLE") {
          copyAllowed(node, target); // etiqueta no permitida: se queda su contenido, sin la etiqueta
        }
      }
    }
  }

  function richClean(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html"); // documento inerte: no ejecuta nada
    const box = document.createElement("div");
    copyAllowed(doc.body, box);
    return box.innerHTML;
  }

  // HTML seguro de un valor guardado (texto plano antiguo o HTML del editor).
  function richHtml(value) {
    if (typeof value !== "string" || !value) return "";
    return RICH_DETECT.test(value) ? richClean(value) : escapeHtml(value).replace(/\r?\n/g, "<br>");
  }

  // Solo el texto, en una línea (vistas previas, orden, búsquedas y comprobar si está vacío).
  function richPlain(value) {
    const box = document.createElement("div");
    box.innerHTML = richHtml(value);
    box.querySelectorAll("br, div, li").forEach((el) => el.append(document.createTextNode(" ")));
    return box.textContent.replace(/\s+/g, " ").trim();
  }

  // La altura del cuadro se recuerda: al volver a abrir una tarea, el cuadro mide lo que lo dejaste.
  const EDITOR_KEY = "flucti:editor:v1";
  function savedEditorHeight(key) {
    try {
      return Number(JSON.parse(localStorage.getItem(EDITOR_KEY) || "{}")[key]) || 0;
    } catch {
      return 0;
    }
  }
  function saveEditorHeight(key, px) {
    try {
      const all = JSON.parse(localStorage.getItem(EDITOR_KEY) || "{}");
      all[key] = Math.round(px);
      localStorage.setItem(EDITOR_KEY, JSON.stringify(all));
    } catch {
      /* Sin almacenamiento disponible */
    }
  }

  function richEditor({ value, onChange, label, heightKey = "default" }) {
    const area = h("div", { class: "rich-area", contenteditable: "true", role: "textbox", "aria-multiline": "true", "aria-label": label, html: richHtml(value) });

    const sync = () => {
      const clean = richClean(area.innerHTML);
      onChange(richPlain(clean) ? clean : "");
    };

    const tools = [
      { command: "bold", label: "rich.bold", content: h("strong", { text: "B" }) },
      { command: "italic", label: "rich.italic", content: h("em", { text: "I" }) },
      { command: "strikeThrough", label: "rich.strike", content: h("s", { text: "S" }) },
      { command: "insertUnorderedList", label: "rich.ul", content: icon("listBullet", 16) },
      { command: "insertOrderedList", label: "rich.ol", content: icon("listNumber", 16) },
    ];
    const buttons = tools.map((tool) =>
      h("button", {
        type: "button",
        class: "rich-btn",
        "aria-label": I18n.t(tool.label),
        title: I18n.t(tool.label),
        "aria-pressed": "false",
        onmousedown: (event) => event.preventDefault(), // el texto no pierde la selección al pulsar
        onclick: () => {
          if (document.activeElement !== area) area.focus(); // si ya tiene el foco, el cursor se queda donde estaba
          const caret = tool.command.startsWith("insert") ? caretOffset() : null; // solo las listas lo necesitan
          document.execCommand(tool.command);
          if (caret !== null) setCaret(caret); // Chrome lleva el cursor al principio al crear una lista
          sync();
          paintTools();
        },
      }, tool.content)
    );

    // Posición del cursor (en caracteres desde el principio) cuando no hay texto seleccionado.
    function caretOffset() {
      const selection = window.getSelection();
      if (!selection.rangeCount || !area.contains(selection.anchorNode)) return null;
      const range = selection.getRangeAt(0);
      if (!range.collapsed) return null;
      const before = document.createRange();
      before.selectNodeContents(area);
      before.setEnd(range.endContainer, range.endOffset);
      return before.toString().length;
    }

    function setCaret(offset) {
      const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
      let left = offset;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (left <= node.length) {
          const range = document.createRange();
          range.setStart(node, left);
          range.collapse(true);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
        left -= node.length;
      }
    }

    function paintTools() {
      if (document.activeElement !== area) return;
      tools.forEach((tool, i) => {
        let on = false;
        try {
          on = document.queryCommandState(tool.command);
        } catch {
          /* se ignora */
        }
        buttons[i].setAttribute("aria-pressed", String(on));
      });
    }

    area.addEventListener("input", () => {
      if (!area.textContent.trim() && !area.querySelector("li")) area.innerHTML = ""; // que no quede un <br> suelto
      sync();
    });
    // Se pega solo el texto, sin estilos de otras páginas.
    area.addEventListener("paste", (event) => {
      event.preventDefault();
      const clipboard = event.clipboardData || window.clipboardData;
      document.execCommand("insertText", false, clipboard ? clipboard.getData("text/plain") : "");
    });
    let wasConnected = false;
    const onSelection = () => {
      if (area.isConnected) wasConnected = true;
      else if (wasConnected) return document.removeEventListener("selectionchange", onSelection);
      paintTools();
    };
    document.addEventListener("selectionchange", onSelection);

    const saved = savedEditorHeight(heightKey);
    if (saved) area.style.height = `${saved}px`;
    if (window.ResizeObserver) {
      let known = saved;
      let timer = 0;
      new ResizeObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const height = area.offsetHeight;
          if (height <= 0) return; // la ventana está cerrada
          if (!known) known = height; // primera medida: es la de partida, no un cambio del usuario
          else if (Math.abs(height - known) > 2) {
            known = height;
            saveEditorHeight(heightKey, height);
          }
        }, 200);
      }).observe(area);
    }

    return h("div", { class: "rich" }, h("div", { class: "rich-bar", role: "toolbar", "aria-label": I18n.t("rich.toolbar") }, buttons), area);
  }

  return { h, icon, uid, clone, dates, segmented, dropdown, datePicker, timePicker, richEditor, richHtml, richPlain, closePopover };
})();