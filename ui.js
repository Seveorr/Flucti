"use strict";

/* ==========================================================================
   ui.js — componentes de interfaz propios (con el aspecto de la app en todos los navegadores)

   h()           crea elementos del DOM        icon()        iconos
   dates         utilidades de fechas          segmented()   deslizador de varias opciones
   dropdown()    lista desplegable             datePicker()  selector de día
   timePicker()  selector de hora
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
      const today = todayString();
      const cells = [];
      for (let i = 0; i < blanks; i++) cells.push(h("span"));
      for (let day = 1; day <= total; day++) {
        const date = `${view.slice(0, 7)}-${pad2(day)}`;
        cells.push(
          h("button", {
            type: "button",
            class: `cal-day${date === current ? " is-selected" : ""}${date === today ? " is-today" : ""}`,
            "aria-pressed": String(date === current),
            "aria-label": new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(parseDateString(date)),
            text: String(day),
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
     Dos columnas con desplazamiento: horas (00-23) y minutos (00-59).
     ------------------------------------------------------------------------ */
  function timePicker({ value, onChange, label, placeholder, disabled }) {
    let current = value || "";
    const root = h("div", { class: "picker picker-time" });
    const text = h("span", { class: "picker-text" });
    const button = h("button", { type: "button", class: "field picker-button", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-label": label, disabled: Boolean(disabled) }, icon("clock", 16), text);
    const panel = h("div", { class: "popover time-panel", role: "dialog", "aria-label": label, hidden: true });

    const cells = (count, which) =>
      Array.from({ length: count }, (_, i) =>
        h("button", { type: "button", class: "time-cell", text: pad2(i), onclick: () => (which === "hour" ? pick(pad2(i), null) : pick(null, pad2(i))) })
      );
    const hourButtons = cells(24, "hour");
    const minuteButtons = cells(60, "minute");
    const hourColumn = h("div", { class: "time-col hours" }, hourButtons);
    const minuteColumn = h("div", { class: "time-col minutes" }, minuteButtons);

    function paint() {
      text.textContent = current || placeholder;
      text.classList.toggle("is-placeholder", !current);
      const [hh, mm] = current ? current.split(":") : [null, null];
      hourButtons.forEach((b, i) => b.classList.toggle("is-selected", pad2(i) === hh));
      minuteButtons.forEach((b, i) => b.classList.toggle("is-selected", pad2(i) === mm));
    }

    // Al abrir, cada columna se desplaza hasta la hora y los minutos elegidos.
    function reveal(column, buttons, selected) {
      const target = buttons[selected];
      const top = target ? target.offsetTop - column.clientHeight / 2 + target.offsetHeight / 2 : 0;
      column.scrollTop = Number.isFinite(top) ? Math.max(0, top) : 0;
    }

    // Al elegir la hora, los minutos se quedan como estaban (o en punto); al elegir los minutos se cierra.
    function pick(hour, minute) {
      const [hh, mm] = current ? current.split(":") : [null, null];
      current = `${hour ?? hh ?? "09"}:${minute ?? mm ?? "00"}`;
      paint();
      if (onChange) onChange(current);
      if (minute !== null) {
        pop.close();
        button.focus();
      }
    }

    panel.append(hourColumn, minuteColumn);
    root.append(button, panel);
    const pop = makePopover(root, button, panel, () => {
      const [hh, mm] = current ? current.split(":").map(Number) : [-1, -1];
      reveal(hourColumn, hourButtons, hh);
      reveal(minuteColumn, minuteButtons, mm);
    });
    paint();
    root.picker = {
      get value() { return current; },
      set: (v) => { current = v || ""; paint(); },
      setDisabled: (isDisabled) => { button.disabled = isDisabled; if (isDisabled) pop.close(); },
    };
    return root;
  }

  return { h, icon, uid, clone, dates, segmented, dropdown, datePicker, timePicker, closePopover };
})();