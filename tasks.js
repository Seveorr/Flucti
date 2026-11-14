"use strict";

/* ==========================================================================
   tasks.js — tareas, listas y parámetros (todo se guarda en este dispositivo)

   Datos (localStorage "flucti:data:v1"):
     params: qué parámetros tiene una tarea (los que trae la app y los que añade el usuario)
     lists:  listas { id, name, hidden, sort }; name null = nombre por defecto ("Actual")
     tasks:  tareas { id, listId, kind, title, values, recurrence, createdAt }
   ========================================================================== */
(() => {
  const { t, tn } = I18n;
  const $ = (id) => document.getElementById(id);

  const STORAGE_KEY = "flucti:data:v1";
  const STRIKE_DELAY = 380; // tiempo que se ve la tarea tachada
  const LEAVE_DURATION = 320; // duración de la animación de salida

  /* ------------------------------------------------------------------------
     Utilidades: construir elementos, iconos e identificadores
     ------------------------------------------------------------------------ */
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
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
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

  function shortDate(text, today) {
    const sameYear = text.slice(0, 4) === today.slice(0, 4);
    const options = { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) };
    return new Intl.DateTimeFormat(I18n.current().locale, options).format(parseDateString(text));
  }

  // Texto de una fecha con hora opcional: "Hoy", "Mañana 18:00", "mié 12 nov", "Vencida · 3 nov"…
  function dateLabel(value, today) {
    const diff = diffDays(value.date, today);
    let text;
    if (diff === 0) text = t("due.today");
    else if (diff === 1) text = t("due.tomorrow");
    else if (diff < 0) text = t("due.overdue", { date: shortDate(value.date, today) });
    else text = shortDate(value.date, today);
    return { text: text + (value.time ? ` ${value.time}` : ""), diff };
  }

  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes primero (0 = domingo)

  function weekdayShort(day) {
    return new Intl.DateTimeFormat(I18n.current().locale, { weekday: "short" }).format(new Date(2021, 0, 3 + day));
  }

  /* ------------------------------------------------------------------------
     Parámetros de las tareas
     Los que trae la app tienen una definición fija (BUILTIN); del usuario solo se guarda
     en qué tipos de tarea aparecen (once / recurring) y si son obligatorios.
     ------------------------------------------------------------------------ */
  const TYPES = ["text", "textarea", "number", "date", "select", "checkbox"];

  const BUILTIN = {
    title: { type: "text", kinds: ["once", "recurring"], locked: true },
    description: { type: "textarea", kinds: ["once", "recurring"] },
    due: { type: "date", kinds: ["once"] },
    date: { type: "date", kinds: ["recurring"] },
    repeat: { type: "recurrence", kinds: ["recurring"], locked: true },
    planned: { type: "date", kinds: ["once", "recurring"] },
    energy: { type: "select", kinds: ["once", "recurring"], options: ["high", "medium", "low"] },
  };

  // Por defecto: descripción, vencimiento (hora opcional), planificación (opcional) y energía.
  const DEFAULT_PARAMS = [
    { id: "title", once: true, recurring: true, required: true },
    { id: "description", once: true, recurring: true, required: false },
    { id: "due", once: true, recurring: false, required: false },
    { id: "date", once: false, recurring: true, required: true },
    { id: "repeat", once: false, recurring: true, required: true },
    { id: "planned", once: true, recurring: true, required: false },
    { id: "energy", once: true, recurring: true, required: false },
  ];

  const ENERGY_RANK = { low: 1, medium: 2, high: 3 };
  const DEFAULT_SORT = [
    { by: "due", dir: "asc" }, // primero las que vencen antes
    { by: "energy", dir: "desc" }, // y, a igual fecha, las que más energía suponen
  ];

  /* ------------------------------------------------------------------------
     Estado: carga, normalización, migración y guardado
     ------------------------------------------------------------------------ */
  function defaultState() {
    const listId = uid();
    return {
      version: 1,
      params: DEFAULT_PARAMS.map((p) => ({ ...p })),
      lists: [{ id: listId, name: null, hidden: false, sort: clone(DEFAULT_SORT) }],
      currentListId: listId,
      tasks: [],
    };
  }

  function normalizeState(data) {
    const base = defaultState();
    if (!data || typeof data !== "object") return base;

    const params = [];
    for (const p of Array.isArray(data.params) ? data.params : []) {
      if (!p || typeof p.id !== "string") continue;
      if (BUILTIN[p.id]) {
        const def = BUILTIN[p.id];
        params.push({
          id: p.id,
          once: def.kinds.includes("once") && (def.locked || p.once === true),
          recurring: def.kinds.includes("recurring") && (def.locked || p.recurring === true),
          required: def.locked || p.required === true,
        });
      } else if (TYPES.includes(p.type) && typeof p.name === "string" && p.name) {
        params.push({
          id: p.id,
          type: p.type,
          name: p.name,
          options: p.type === "select" && Array.isArray(p.options) ? p.options.filter((o) => typeof o === "string" && o) : undefined,
          once: p.once === true,
          recurring: p.recurring === true,
          required: p.required === true,
        });
      }
    }
    for (const def of DEFAULT_PARAMS) if (!params.some((p) => p.id === def.id)) params.push({ ...def });

    const lists = (Array.isArray(data.lists) ? data.lists : [])
      .filter((l) => l && typeof l.id === "string")
      .map((l) => ({
        id: l.id,
        name: typeof l.name === "string" && l.name.trim() ? l.name : null,
        hidden: l.hidden === true,
        sort: Array.isArray(l.sort)
          ? l.sort.filter((s) => s && typeof s.by === "string" && (s.dir === "asc" || s.dir === "desc")).map((s) => ({ by: s.by, dir: s.dir }))
          : clone(DEFAULT_SORT),
      }));
    if (!lists.length) lists.push(base.lists[0]);
    if (lists.every((l) => l.hidden)) lists[0].hidden = false;

    const tasks = [];
    for (const x of Array.isArray(data.tasks) ? data.tasks : []) {
      if (!x || typeof x.id !== "string" || typeof x.title !== "string" || !x.title.trim()) continue;
      const task = {
        id: x.id,
        listId: lists.some((l) => l.id === x.listId) ? x.listId : lists[0].id,
        kind: x.kind === "recurring" && x.recurrence ? "recurring" : "once",
        title: x.title,
        values: x.values && typeof x.values === "object" ? x.values : {},
        createdAt: Number.isFinite(x.createdAt) ? x.createdAt : Date.now(),
      };
      if (task.kind === "recurring") task.recurrence = x.recurrence;
      tasks.push(task);
    }

    const visible = lists.filter((l) => !l.hidden);
    const current = lists.find((l) => l.id === data.currentListId && !l.hidden) || visible[0];
    return { version: 1, params, lists, currentListId: current.id, tasks };
  }

  // Recoge las tareas de versiones anteriores de la app (lista simple, por cuenta o con sincronización).
  function migrateOldTasks(state) {
    const found = new Map();
    const add = (items) => {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        if (item && typeof item.id === "string" && typeof item.name === "string" && item.name.trim() && !found.has(item.id)) {
          found.set(item.id, item);
        }
      }
    };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key === "tasks:v1" || key === "tareas:v1" || key.startsWith("tasks:v1:")) {
          add(JSON.parse(localStorage.getItem(key) || "[]"));
        } else if (key.startsWith("tasks:v2:")) {
          add((JSON.parse(localStorage.getItem(key) || "{}") || {}).tasks);
        }
      }
    } catch {
      /* se ignora: se empieza sin tareas antiguas */
    }
    let n = 0;
    for (const item of found.values()) {
      state.tasks.push({
        id: item.id,
        listId: state.lists[0].id,
        kind: "once",
        title: item.name.trim().slice(0, 120),
        values: {},
        createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now() - n++,
      });
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeState(JSON.parse(raw));
    } catch {
      /* datos dañados: se empieza de cero */
    }
    const fresh = defaultState();
    migrateOldTasks(fresh);
    return fresh;
  }

  let state = loadState();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* Sin almacenamiento disponible */
    }
  }

  /* ------------------------------------------------------------------------
     Consultas sobre el estado
     ------------------------------------------------------------------------ */
  const visibleLists = () => state.lists.filter((l) => !l.hidden);
  const currentList = () => state.lists.find((l) => l.id === state.currentListId) || state.lists[0];
  const listName = (list) => list.name || t("list.default");

  function ensureCurrentList() {
    const current = state.lists.find((l) => l.id === state.currentListId);
    if (!current || current.hidden) state.currentListId = (visibleLists()[0] || state.lists[0]).id;
  }

  // Parámetro con todos sus datos: nombre traducido, tipo, en qué tareas aparece y si es obligatorio.
  function paramInfo(p) {
    const def = BUILTIN[p.id];
    return {
      id: p.id,
      builtin: Boolean(def),
      type: def ? def.type : p.type,
      kinds: def ? def.kinds : ["once", "recurring"],
      locked: Boolean(def && def.locked),
      options: def ? def.options || null : p.options || null,
      name: def ? t(`param.${p.id}`) : p.name,
      once: p.once,
      recurring: p.recurring,
      required: p.required,
    };
  }

  const allParams = () => state.params.map(paramInfo);
  const paramsFor = (kind) => allParams().filter((p) => p[kind]); // los que lleva ese tipo de tarea
  const paramById = (id) => allParams().find((p) => p.id === id);
  const optionLabel = (info, value) => (info.id === "energy" ? t(`energy.${value}`) : value);

  /* ------------------------------------------------------------------------
     Orden de las tareas
     ------------------------------------------------------------------------ */
  const dueOf = (task) => (task.kind === "recurring" ? task.values.date : task.values.due) || null;
  const dateKey = (v) => (v && v.date ? `${v.date}T${v.time || "23:59"}` : null);
  const kindOfType = (type) => ({ date: "date", number: "number", select: "level", checkbox: "level" })[type] || "text";

  // Criterios por los que se puede ordenar una lista.
  function sortCriteria() {
    const criteria = [
      { id: "due", label: t("param.due"), kind: "date" },
      { id: "planned", label: t("param.planned"), kind: "date" },
      { id: "energy", label: t("param.energy"), kind: "level" },
      { id: "title", label: t("param.title"), kind: "text" },
      { id: "created", label: t("sort.created"), kind: "created" },
    ];
    for (const p of allParams()) if (!p.builtin) criteria.push({ id: p.id, label: p.name, kind: kindOfType(p.type) });
    return criteria;
  }

  function sortValue(task, by, params) {
    switch (by) {
      case "due":
        return dateKey(dueOf(task));
      case "planned":
        return dateKey(task.values.planned);
      case "energy":
        return ENERGY_RANK[task.values.energy] ?? null;
      case "title":
        return task.title;
      case "created":
        return task.createdAt;
      default: {
        const info = params.get(by);
        const v = task.values[by];
        if (!info || v === undefined || v === null || v === "") return null;
        if (info.type === "number") return Number(v);
        if (info.type === "date") return dateKey(v);
        if (info.type === "select") {
          const i = (info.options || []).indexOf(v);
          return i === -1 ? null : i;
        }
        if (info.type === "checkbox") return v ? 1 : 0;
        return String(v);
      }
    }
  }

  // Ordena por el primer criterio y, si empatan, por el siguiente. Lo que no tiene valor va siempre al final.
  function sortTasks(tasks, sort) {
    const kinds = new Map(sortCriteria().map((c) => [c.id, c.kind]));
    const params = new Map(allParams().map((p) => [p.id, p]));
    const rules = sort.filter((r) => kinds.has(r.by));
    const locale = I18n.current().locale;

    return [...tasks].sort((a, b) => {
      for (const { by, dir } of rules) {
        const va = sortValue(a, by, params);
        const vb = sortValue(b, by, params);
        const missingA = va === null || va === undefined;
        const missingB = vb === null || vb === undefined;
        if (missingA && missingB) continue;
        if (missingA) return 1;
        if (missingB) return -1;
        let cmp;
        if (kinds.get(by) === "text") cmp = String(va).localeCompare(String(vb), locale, { sensitivity: "base" });
        else cmp = va < vb ? -1 : va > vb ? 1 : 0;
        if (cmp !== 0) return dir === "desc" ? -cmp : cmp;
      }
      return b.createdAt - a.createdAt; // a igualdad total, la más reciente primero
    });
  }

  /* ------------------------------------------------------------------------
     Tareas recurrentes
     rec = { mode: "interval", every, unit, anchor } o { mode: "weekdays", days, anchor }
     ------------------------------------------------------------------------ */
  function occurrenceAt(rec, k) {
    switch (rec.unit) {
      case "day":
        return addDays(rec.anchor, rec.every * k);
      case "week":
        return addDays(rec.anchor, 7 * rec.every * k);
      case "month":
        return addMonths(rec.anchor, rec.every * k);
      default:
        return addMonths(rec.anchor, 12 * rec.every * k);
    }
  }

  // Primera fecha de la regla estrictamente posterior a "after".
  function nextOccurrence(rec, after) {
    if (rec.mode === "weekdays") {
      for (let i = 1; i <= 7; i++) {
        const day = addDays(after, i);
        if (rec.days.includes(parseDateString(day).getDay())) return day;
      }
      return addDays(after, 7);
    }
    for (let k = 0; k < 20000; k++) {
      const day = occurrenceAt(rec, k);
      if (day > after) return day;
    }
    return addDays(after, 1);
  }

  // Al completar una tarea recurrente pasa a su siguiente fecha (siempre posterior a hoy y a la actual).
  function advanceRecurring(task, today) {
    const previous = task.values.date || { date: today, time: "" };
    const current = previous.date;
    const next = nextOccurrence(task.recurrence, current > today ? current : today);
    task.values.date = { date: next, time: previous.time || "" };
    const planned = task.values.planned;
    if (planned && planned.date) planned.date = addDays(planned.date, diffDays(next, current)); // conserva la distancia
    return next;
  }

  function repeatSummary(rec) {
    if (rec.mode === "weekdays") {
      return WEEK_ORDER.filter((d) => rec.days.includes(d)).map(weekdayShort).join(", ");
    }
    if (rec.every === 1) return t(`repeat.summary.${rec.unit}`);
    return t("repeat.summary.many", { count: rec.every, unit: tn(`repeat.unit.${rec.unit}`, rec.every) });
  }

  const recurrenceValid = (rec) =>
    rec.mode === "weekdays" ? rec.days.length > 0 : Number.isInteger(rec.every) && rec.every >= 1 && rec.every <= 999;

  /* ------------------------------------------------------------------------
     Lista de tareas en pantalla
     ------------------------------------------------------------------------ */
  function formatValue(info, value) {
    if (info.type === "date") return value && value.date ? dateLabel(value, todayString()).text : "";
    if (info.type === "select") return optionLabel(info, value);
    return String(value);
  }

  // Datos pequeños bajo el título: fecha, repetición, planificación, energía y parámetros propios.
  function metaItems(task, dueLabel) {
    const active = new Set(paramsFor(task.kind).map((p) => p.id));
    const today = todayString();
    const items = [];

    if (dueLabel) {
      const extra = dueLabel.diff === 1 ? " meta-tomorrow" : dueLabel.diff < 0 ? " meta-overdue" : "";
      items.push(h("span", { class: `meta${extra}`, text: dueLabel.text }));
    }
    if (task.kind === "recurring" && task.recurrence) {
      items.push(h("span", { class: "meta" }, icon("repeat", 13), repeatSummary(task.recurrence)));
    }
    const planned = task.values.planned;
    if (active.has("planned") && planned && planned.date) {
      const when = shortDate(planned.date, today) + (planned.time ? ` ${planned.time}` : "");
      items.push(h("span", { class: "meta", text: t("meta.planned", { date: when }) }));
    }
    if (active.has("energy") && ENERGY_RANK[task.values.energy]) {
      items.push(
        h(
          "span",
          {
            class: "energy",
            role: "img",
            "aria-label": `${t("param.energy")}: ${t(`energy.${task.values.energy}`)}`,
            dataset: { level: ENERGY_RANK[task.values.energy] },
          },
          h("i"),
          h("i"),
          h("i")
        )
      );
    }
    for (const info of allParams()) {
      if (info.builtin || !active.has(info.id)) continue;
      const value = task.values[info.id];
      if (value === undefined || value === null || value === "" || value === false) continue;
      items.push(h("span", { class: "meta", text: value === true ? info.name : `${info.name}: ${formatValue(info, value)}` }));
    }
    return items;
  }

  function taskElement(task, entering) {
    const due = dueOf(task);
    const dueLabel = due && due.date ? dateLabel(due, todayString()) : null;
    const tomorrow = dueLabel && dueLabel.diff === 1; // las que vencen mañana se resaltan
    const item = h("li", { class: `task${entering ? " entering" : ""}${tomorrow ? " due-tomorrow" : ""}`, dataset: { id: task.id } });

    const checkbox = h("input", {
      type: "checkbox",
      class: "check",
      "aria-label": t("task.complete", { name: task.title }),
      onchange: (event) => {
        if (event.target.checked) completeTask(task.id, item);
      },
    });
    const meta = metaItems(task, dueLabel);
    const body = h(
      "div",
      { class: "task-body" },
      h("span", { class: "task-name", text: task.title }),
      task.values.description ? h("span", { class: "task-desc", text: task.values.description }) : null,
      meta.length ? h("div", { class: "task-meta" }, meta) : null
    );
    item.append(h("div", { class: "task-row" }, h("div", { class: "task-content" }, checkbox, body)));
    return item;
  }

  function updateEmpty() {
    $("empty").hidden = state.tasks.some((x) => x.listId === state.currentListId);
  }

  function renderTasks(enteringId) {
    const list = currentList();
    const tasks = sortTasks(state.tasks.filter((x) => x.listId === list.id), list.sort);
    $("task-list").replaceChildren(...tasks.map((x) => taskElement(x, x.id === enteringId)));
    updateEmpty();
  }

  function completeTask(id, item) {
    const task = state.tasks.find((x) => x.id === id);
    if (!task) return;
    item.classList.add("done");

    if (task.kind === "recurring") {
      advanceRecurring(task, todayString()); // vuelve a aparecer con su siguiente fecha
      saveState();
      setTimeout(() => renderTasks(), STRIKE_DELAY);
      return;
    }
    state.tasks = state.tasks.filter((x) => x.id !== id);
    saveState();
    setTimeout(() => {
      item.classList.add("leaving");
      setTimeout(() => {
        item.remove();
        updateEmpty();
        renderHomeLists();
      }, LEAVE_DURATION);
    }, STRIKE_DELAY);
  }

  function renderHead() {
    $("tasks-title").textContent = listName(currentList());
  }

  /* ------------------------------------------------------------------------
     Listas en la pantalla de inicio
     ------------------------------------------------------------------------ */
  let addingList = false;

  function selectList(id) {
    state.currentListId = id;
    saveState();
    renderAll();
    Flucti.goToTasks();
  }

  function createList(name) {
    const list = { id: uid(), name, hidden: false, sort: clone(DEFAULT_SORT) };
    state.lists.push(list);
    state.currentListId = list.id;
    saveState();
    renderAll();
  }

  function newListField() {
    const input = h("input", {
      class: "chip-field",
      type: "text",
      maxlength: 30,
      placeholder: t("list.new.placeholder"),
      "aria-label": t("list.new.placeholder"),
    });
    let finished = false;
    const finish = (create) => {
      if (finished) return;
      finished = true;
      addingList = false;
      const name = input.value.trim();
      if (create && name) createList(name);
      else renderHomeLists();
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finish(true);
      } else if (event.key === "Escape") {
        finish(false);
      }
    });
    input.addEventListener("blur", () => finish(true)); // al salir se crea si hay nombre
    setTimeout(() => input.focus(), 0);
    return input;
  }

  function renderHomeLists() {
    const chips = visibleLists().map((list) => {
      const count = state.tasks.filter((x) => x.listId === list.id).length;
      return h(
        "button",
        {
          class: "chip",
          type: "button",
          "aria-pressed": String(list.id === state.currentListId),
          onclick: () => selectList(list.id),
        },
        h("span", { text: listName(list) }),
        count ? h("span", { class: "chip-count", text: String(count) }) : null
      );
    });
    const add = addingList
      ? newListField()
      : h(
          "button",
          {
            class: "chip chip-add",
            type: "button",
            "aria-label": t("list.add"),
            onclick: () => {
              addingList = true;
              renderHomeLists();
            },
          },
          icon("plus", 16)
        );
    $("home-lists").replaceChildren(...chips, add);
  }

  function renderAll(enteringId) {
    ensureCurrentList();
    renderHomeLists();
    renderHead();
    renderTasks(enteringId);
  }

  /* ------------------------------------------------------------------------
     Elemento "deslizador" de varias opciones (tipo de tarea, tipo de repetición)
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
     Ventana de la tarea (parámetros)
     Cerrarla guarda la tarea; sin título se descarta; si falta un campo obligatorio no se cierra.
     ------------------------------------------------------------------------ */
  let draft = null; // { kind, values, recurrence, showErrors }

  const isEmptyValue = (info, v) => {
    if (info.type === "date") return !(v && v.date);
    if (info.type === "checkbox") return !v;
    return v === undefined || v === null || String(v).trim() === "";
  };

  function isMissing(info) {
    if (info.id === "repeat") return !recurrenceValid(draft.recurrence);
    if (!info.required) return false;
    return isEmptyValue(info, draft.values[info.id]);
  }

  const missingParams = () => paramsFor(draft.kind).filter((p) => p.id !== "title" && isMissing(p));

  function dateControl(info) {
    const v = draft.values[info.id] || (draft.values[info.id] = { date: "", time: "" });
    const time = h("input", {
      class: "field",
      type: "time",
      "aria-label": t("field.time"),
      value: v.time,
      disabled: !v.date,
      oninput: (event) => (v.time = event.target.value),
    });
    const date = h("input", {
      class: "field",
      type: "date",
      "aria-label": info.name,
      value: v.date,
      oninput: (event) => {
        v.date = event.target.value;
        if (!v.date) {
          v.time = "";
          time.value = "";
        }
        time.disabled = !v.date;
      },
    });
    const clear = h(
      "button",
      {
        class: "icon-btn small",
        type: "button",
        "aria-label": t("field.clear"),
        onclick: () => {
          v.date = "";
          v.time = "";
          date.value = "";
          time.value = "";
          time.disabled = true;
        },
      },
      icon("close", 16)
    );
    return h("div", { class: "date-row" }, date, time, clear);
  }

  function recurrenceControl() {
    const rec = draft.recurrence;
    const host = h("div", { class: "recurrence" });

    const render = () => {
      const modes = segmented({
        label: t("repeat.mode.label"),
        options: [
          { value: "interval", label: t("repeat.mode.interval") },
          { value: "weekdays", label: t("repeat.mode.weekdays") },
        ],
        value: rec.mode,
        onChange: (mode) => {
          rec.mode = mode;
          render();
        },
      });

      let detail;
      if (rec.mode === "interval") {
        const unitOptions = ["day", "week", "month", "year"].map((unit) =>
          h("option", { value: unit, text: tn(`repeat.unit.${unit}`, rec.every), selected: unit === rec.unit })
        );
        const unitSelect = h(
          "select",
          { class: "field", "aria-label": t("repeat.every"), onchange: (event) => (rec.unit = event.target.value) },
          unitOptions
        );
        const amount = h("input", {
          class: "field narrow",
          type: "number",
          min: 1,
          max: 999,
          inputmode: "numeric",
          value: rec.every,
          "aria-label": t("repeat.every"),
          oninput: (event) => {
            rec.every = Number(event.target.value) || 0;
            unitOptions.forEach((option) => (option.textContent = tn(`repeat.unit.${option.value}`, rec.every)));
          },
        });
        detail = h("div", { class: "repeat-row" }, h("span", { class: "repeat-label", text: t("repeat.every") }), amount, unitSelect);
      } else {
        detail = h(
          "div",
          { class: "weekdays", role: "group" },
          WEEK_ORDER.map((day) => {
            const chip = h("button", {
              type: "button",
              class: "day-chip",
              "aria-pressed": String(rec.days.includes(day)),
              text: weekdayShort(day),
            });
            chip.addEventListener("click", () => {
              rec.days = rec.days.includes(day) ? rec.days.filter((d) => d !== day) : [...rec.days, day];
              chip.setAttribute("aria-pressed", String(rec.days.includes(day)));
            });
            return chip;
          })
        );
      }
      host.replaceChildren(modes, detail);
    };

    render();
    return host;
  }

  function buildField(info) {
    const missing = draft.showErrors && (info.id === "title" ? false : isMissing(info));
    const group = h("div", { class: `field-group${missing ? " invalid" : ""}`, dataset: { param: info.id } });
    const inputId = `task-field-${info.id}`;
    const required = info.required || info.id === "title" ? h("span", { class: "req", "aria-hidden": "true", text: " *" }) : null;
    const label = (tag = "label") => h(tag, { class: "field-label", for: tag === "label" ? inputId : null }, info.name, required);
    const value = draft.values[info.id];
    const store = (v) => (draft.values[info.id] = v);

    if (info.type === "textarea") {
      group.append(label(), h("textarea", { class: "field", id: inputId, rows: 3, maxlength: 1000, value: value || "", oninput: (e) => store(e.target.value) }));
    } else if (info.type === "text" || info.type === "number") {
      const props = { class: "field", id: inputId, type: info.type === "number" ? "number" : "text", value: value ?? "", oninput: (e) => store(e.target.value) };
      if (info.type === "number") Object.assign(props, { inputmode: "decimal", step: "any" });
      else props.maxlength = info.id === "title" ? 120 : 200;
      if (info.id === "title") {
        props.onkeydown = (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            attemptCloseTask();
          }
        };
      }
      group.append(label(), h("input", props));
    } else if (info.type === "select") {
      const options = [h("option", { value: "", text: t("field.none") })];
      for (const option of info.options || []) {
        options.push(h("option", { value: option, text: optionLabel(info, option), selected: value === option }));
      }
      group.append(label(), h("select", { class: "field", id: inputId, onchange: (e) => store(e.target.value) }, options));
    } else if (info.type === "checkbox") {
      group.append(
        h("label", { class: "check-row" }, h("input", { type: "checkbox", checked: Boolean(value), onchange: (e) => store(e.target.checked) }), info.name, required)
      );
    } else if (info.type === "date") {
      group.append(label("div"), dateControl(info));
    } else if (info.type === "recurrence") {
      group.append(label("div"), recurrenceControl());
    }
    return group;
  }

  function renderTaskFields() {
    $("task-fields").replaceChildren(...paramsFor(draft.kind).map(buildField));
    $("task-error").textContent = draft.showErrors && missingParams().length ? t("task.error.required") : "";
  }

  function renderTaskDialog() {
    $("task-kind").replaceChildren(
      segmented({
        label: t("task.kind.label"),
        options: [
          { value: "once", label: t("kind.once") },
          { value: "recurring", label: t("kind.recurring") },
        ],
        value: draft.kind,
        onChange: (kind) => {
          draft.kind = kind;
          if (kind === "recurring" && !draft.values.date) draft.values.date = { date: todayString(), time: "" };
          renderTaskFields();
        },
      })
    );
    renderTaskFields();
  }

  function openTaskDialog(title = "") {
    draft = {
      kind: "once",
      values: { title },
      recurrence: { mode: "interval", every: 1, unit: "week", days: [] },
      showErrors: false,
    };
    renderTaskDialog();
    Flucti.openDialog($("task-dialog"));
    if (!title) setTimeout(() => $("task-fields").querySelector("input")?.focus(), 0);
  }

  function taskFromDraft() {
    const kind = draft.kind;
    const values = {};
    for (const info of paramsFor(kind)) {
      if (info.id === "title" || info.id === "repeat") continue;
      const v = draft.values[info.id];
      if (isEmptyValue(info, v)) continue;
      if (info.type === "date") values[info.id] = { date: v.date, time: v.time || "" };
      else if (info.type === "number") values[info.id] = Number(v);
      else values[info.id] = typeof v === "string" ? v.trim() : v;
    }

    const task = {
      id: uid(),
      listId: state.currentListId,
      kind,
      title: draft.values.title.trim().replace(/\s+/g, " "),
      values,
      createdAt: Date.now(),
    };

    if (kind === "recurring") {
      const rec = draft.recurrence;
      let start = (values.date && values.date.date) || todayString();
      let recurrence;
      if (rec.mode === "weekdays") {
        recurrence = { mode: "weekdays", days: [...rec.days].sort((a, b) => a - b), anchor: start };
        // la primera vez cae en uno de los días elegidos
        if (!recurrence.days.includes(parseDateString(start).getDay())) start = nextOccurrence(recurrence, start);
      } else {
        recurrence = { mode: "interval", every: Math.floor(rec.every), unit: rec.unit, anchor: start };
      }
      recurrence.anchor = start;
      values.date = { date: start, time: (values.date && values.date.time) || "" };
      task.recurrence = recurrence;
    }
    return task;
  }

  function closeTaskDialog() {
    draft = null;
    $("task-dialog").close();
  }

  // Cerrar la ventana (X, Esc, fuera o "Guardar") guarda la tarea si está completa.
  function attemptCloseTask() {
    if (!draft) {
      $("task-dialog").close();
      return;
    }
    if (!(draft.values.title || "").trim()) {
      // sin título la tarea se descarta automáticamente
      closeTaskDialog();
      $("task-input").value = "";
      return;
    }
    if (missingParams().length) {
      draft.showErrors = true;
      renderTaskFields();
      return;
    }
    const task = taskFromDraft();
    state.tasks.push(task);
    saveState();
    closeTaskDialog();
    $("task-input").value = "";
    renderAll(task.id);
  }

  // "Guardar" del campo de la pantalla: si no hay parámetros obligatorios se guarda al momento.
  function quickSave() {
    const input = $("task-input");
    const title = input.value.trim().replace(/\s+/g, " ");
    if (!title) {
      input.focus();
      return;
    }
    if (paramsFor("once").some((p) => p.id !== "title" && p.required)) {
      openTaskDialog(title); // faltan datos obligatorios: se piden en la ventana
      return;
    }
    const task = { id: uid(), listId: state.currentListId, kind: "once", title, values: {}, createdAt: Date.now() };
    state.tasks.push(task);
    saveState();
    input.value = "";
    input.focus();
    renderAll(task.id);
  }

  /* ------------------------------------------------------------------------
     Ajustes: parámetros de las tareas y listas
     ------------------------------------------------------------------------ */
  let paramForm = null; // formulario de "Añadir parámetro" (null = cerrado)
  const newParamForm = () => ({ name: "", type: "text", options: "", once: true, recurring: true, required: false, error: false });

  function afterParamsChange() {
    saveState();
    renderTasks();
    if ($("task-dialog").open && draft) renderTaskFields();
  }

  function paramCheck(p, info, field, label) {
    const fixed = info.locked || (field !== "required" && !info.kinds.includes(field));
    if (field !== "required" && !info.kinds.includes(field)) return h("span", { class: "param-na", "aria-hidden": "true", text: "–" });
    return h("input", {
      type: "checkbox",
      class: "param-check",
      checked: info.locked ? true : p[field],
      disabled: fixed,
      "aria-label": `${info.name}: ${label}`,
      onchange: (event) => {
        p[field] = event.target.checked;
        afterParamsChange();
      },
    });
  }

  function paramRow(p) {
    const info = paramInfo(p);
    const cells = [
      h("div", { class: "param-name" }, h("span", { text: info.name }), h("small", { text: t(`type.${info.type}`) })),
      h("div", { class: "param-cell" }, paramCheck(p, info, "once", t("kind.once"))),
      h("div", { class: "param-cell" }, paramCheck(p, info, "recurring", t("kind.recurring"))),
      h("div", { class: "param-cell" }, paramCheck(p, info, "required", t("param.required"))),
    ];
    cells.push(
      info.builtin
        ? h("span")
        : h(
            "button",
            {
              class: "icon-btn small",
              type: "button",
              "aria-label": `${t("param.remove")}: ${info.name}`,
              onclick: () => {
                state.params = state.params.filter((x) => x.id !== p.id);
                for (const list of state.lists) list.sort = list.sort.filter((r) => r.by !== p.id);
                afterParamsChange();
                renderSettings();
              },
            },
            icon("trash", 16)
          )
    );
    return h("div", { class: "param-row" }, ...cells);
  }

  function paramFormElement() {
    const f = paramForm;
    const options = h("input", {
      class: "field",
      type: "text",
      maxlength: 200,
      placeholder: t("param.options"),
      "aria-label": t("param.options"),
      value: f.options,
      hidden: f.type !== "select",
      oninput: (event) => (f.options = event.target.value),
    });
    const typeSelect = h(
      "select",
      {
        class: "field",
        "aria-label": t("param.type"),
        onchange: (event) => {
          f.type = event.target.value;
          options.hidden = f.type !== "select";
        },
      },
      TYPES.map((type) => h("option", { value: type, text: t(`type.${type}`), selected: type === f.type }))
    );
    const check = (field, text) =>
      h("label", { class: "check-row" }, h("input", { type: "checkbox", checked: f[field], onchange: (event) => (f[field] = event.target.checked) }), text);

    const submit = () => {
      const name = f.name.trim();
      const list = f.type === "select" ? [...new Set(f.options.split(",").map((o) => o.trim()).filter(Boolean))] : [];
      if (!name || (f.type === "select" && !list.length)) {
        f.error = true;
        renderSettings();
        return;
      }
      const param = { id: uid(), type: f.type, name, once: f.once, recurring: f.recurring, required: f.required };
      if (f.type === "select") param.options = list;
      state.params.push(param);
      paramForm = null;
      afterParamsChange();
      renderSettings();
    };

    return h(
      "div",
      { class: "param-form" },
      h("input", {
        class: "field",
        type: "text",
        maxlength: 40,
        placeholder: t("param.name"),
        "aria-label": t("param.name"),
        value: f.name,
        oninput: (event) => (f.name = event.target.value),
        onkeydown: (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        },
      }),
      typeSelect,
      options,
      h("div", { class: "check-group" }, check("once", t("kind.once")), check("recurring", t("kind.recurring")), check("required", t("param.required"))),
      f.error ? h("p", { class: "form-error", role: "alert", text: t("param.error") }) : null,
      h(
        "div",
        { class: "form-actions" },
        h("button", { class: "primary-btn", type: "button", text: t("param.create"), onclick: submit }),
        h("button", {
          class: "text-btn",
          type: "button",
          text: t("param.cancel"),
          onclick: () => {
            paramForm = null;
            renderSettings();
          },
        })
      )
    );
  }

  function paramsSection() {
    const grid = h("div", { class: "param-grid", role: "group", "aria-label": t("settings.params") });
    grid.append(
      h("div", { class: "param-row param-header" }, h("span"), ...["col.once", "col.recurring", "col.required"].map((key) => h("span", { text: t(key) })), h("span"))
    );
    for (const p of state.params) grid.append(paramRow(p));

    return h(
      "section",
      { class: "settings-section" },
      h("h3", { class: "settings-heading", text: t("settings.params") }),
      h("p", { class: "settings-hint", text: t("settings.params.hint") }),
      grid,
      paramForm
        ? paramFormElement()
        : h("button", {
            class: "text-btn",
            type: "button",
            text: t("param.add"),
            onclick: () => {
              paramForm = newParamForm();
              renderSettings();
            },
          })
    );
  }

  function toggleListHidden(id) {
    const list = state.lists.find((l) => l.id === id);
    if (!list) return;
    if (!list.hidden && visibleLists().length === 1) return; // siempre queda una lista a la vista
    list.hidden = !list.hidden;
    saveState();
    renderAll();
    renderSettings();
  }

  function listsSection() {
    const rows = state.lists.map((list) => {
      const onlyVisible = !list.hidden && visibleLists().length === 1;
      return h(
        "div",
        { class: `list-row${list.hidden ? " is-hidden" : ""}` },
        h(
          "button",
          {
            class: "icon-btn",
            type: "button",
            "aria-label": `${listName(list)}: ${t(list.hidden ? "list.show" : "list.hide")}`,
            disabled: onlyVisible,
            onclick: () => toggleListHidden(list.id),
          },
          icon(list.hidden ? "eyeOff" : "eye")
        ),
        h(
          "button",
          { class: "list-open", type: "button", "aria-label": `${t("list.edit")}: ${listName(list)}`, onclick: () => openListDialog(list.id) },
          h("span", { class: "list-open-name", text: listName(list) }),
          list.hidden ? h("small", { text: t("list.hidden") }) : null,
          icon("chevron", 16)
        )
      );
    });
    return h("section", { class: "settings-section" }, h("h3", { class: "settings-heading", text: t("settings.lists") }), ...rows);
  }

  function renderSettings() {
    $("settings-body").replaceChildren(paramsSection(), listsSection());
  }

  /* ------------------------------------------------------------------------
     Ventana de una lista: nombre, orden, ocultar y eliminar
     ------------------------------------------------------------------------ */
  let editingListId = null;
  let deleteArmed = false;

  function openListDialog(id) {
    editingListId = id;
    deleteArmed = false;
    renderListDialog();
    Flucti.openDialog($("list-dialog"));
  }

  const defaultDirection = (kind) => (kind === "level" || kind === "created" ? "desc" : "asc");

  function sortRow(list, rule, index, criteria) {
    const kind = (criteria.find((c) => c.id === rule.by) || { kind: "text" }).kind;
    const changed = () => {
      saveState();
      renderTasks();
      renderListDialog();
    };
    return h(
      "div",
      { class: "sort-row" },
      h(
        "select",
        {
          class: "field",
          "aria-label": t("list.sort"),
          onchange: (event) => {
            rule.by = event.target.value;
            rule.dir = defaultDirection((criteria.find((c) => c.id === rule.by) || { kind: "text" }).kind);
            changed();
          },
        },
        criteria.map((c) => h("option", { value: c.id, text: c.label, selected: c.id === rule.by }))
      ),
      h(
        "select",
        {
          class: "field",
          "aria-label": t("list.sort"),
          onchange: (event) => {
            rule.dir = event.target.value;
            changed();
          },
        },
        ["asc", "desc"].map((dir) => h("option", { value: dir, text: t(`dir.${kind}.${dir}`), selected: dir === rule.dir }))
      ),
      index > 0
        ? h(
            "button",
            {
              class: "icon-btn small",
              type: "button",
              "aria-label": t("sort.up"),
              onclick: () => {
                [list.sort[index - 1], list.sort[index]] = [list.sort[index], list.sort[index - 1]];
                changed();
              },
            },
            icon("up", 16)
          )
        : h("span"),
      h(
        "button",
        {
          class: "icon-btn small",
          type: "button",
          "aria-label": t("sort.remove"),
          onclick: () => {
            list.sort.splice(index, 1);
            changed();
          },
        },
        icon("close", 16)
      )
    );
  }

  function deleteList(id) {
    state.lists = state.lists.filter((l) => l.id !== id);
    state.tasks = state.tasks.filter((x) => x.listId !== id);
    ensureCurrentList();
    saveState();
    $("list-dialog").close();
    renderAll();
    if ($("settings-dialog").open) renderSettings();
  }

  function renderListDialog() {
    const list = state.lists.find((l) => l.id === editingListId);
    if (!list) return;
    const criteria = sortCriteria();
    list.sort = list.sort.filter((r) => criteria.some((c) => c.id === r.by)); // por si se borró un parámetro
    const unused = criteria.find((c) => !list.sort.some((r) => r.by === c.id));
    const onlyVisible = !list.hidden && visibleLists().length === 1;

    const nameInput = h("input", {
      class: "field",
      id: "list-name-input",
      type: "text",
      maxlength: 30,
      value: listName(list),
      "aria-label": t("list.name"),
      onchange: (event) => {
        const name = event.target.value.trim();
        if (!name) {
          event.target.value = listName(list);
          return;
        }
        list.name = name;
        saveState();
        renderAll();
      },
      onkeydown: (event) => {
        if (event.key === "Enter") event.target.blur();
      },
    });

    $("list-body").replaceChildren(
      h("div", { class: "field-group" }, h("label", { class: "field-label", for: "list-name-input", text: t("list.name") }), nameInput),
      h(
        "section",
        { class: "settings-section" },
        h("h3", { class: "settings-heading", text: t("list.sort") }),
        h("p", { class: "settings-hint", text: t("list.sort.hint") }),
        ...list.sort.map((rule, i) => sortRow(list, rule, i, criteria)),
        unused
          ? h("button", {
              class: "text-btn",
              type: "button",
              text: t("sort.add"),
              onclick: () => {
                list.sort.push({ by: unused.id, dir: defaultDirection(unused.kind) });
                saveState();
                renderTasks();
                renderListDialog();
              },
            })
          : null
      ),
      h(
        "label",
        { class: "check-row" },
        h("input", {
          type: "checkbox",
          checked: list.hidden,
          disabled: onlyVisible,
          onchange: () => {
            toggleListHidden(list.id);
            renderListDialog();
          },
        }),
        t("list.hide")
      ),
      h("button", {
        class: "text-btn danger",
        type: "button",
        disabled: state.lists.length === 1,
        text: deleteArmed ? t("list.delete.confirm") : t("list.delete"),
        onclick: () => {
          if (deleteArmed) {
            deleteList(list.id);
            return;
          }
          deleteArmed = true;
          renderListDialog();
          setTimeout(() => {
            if (deleteArmed && $("list-dialog").open) {
              deleteArmed = false;
              renderListDialog();
            }
          }, 4000);
        },
      })
    );
  }

  /* ------------------------------------------------------------------------
     Arranque y eventos
     ------------------------------------------------------------------------ */
  const settingsDialog = $("settings-dialog");
  const listDialog = $("list-dialog");
  const taskDialog = $("task-dialog");

  Flucti.bindDialog(settingsDialog);
  Flucti.bindDialog(listDialog);
  Flucti.bindDialog(taskDialog, attemptCloseTask);

  $("menu-btn").addEventListener("click", () => {
    renderSettings();
    Flucti.openDialog(settingsDialog);
  });
  $("settings-close").addEventListener("click", () => settingsDialog.close());
  $("list-close").addEventListener("click", () => listDialog.close());
  listDialog.addEventListener("close", () => {
    renderAll();
    if (settingsDialog.open) renderSettings();
  });

  $("task-close").addEventListener("click", attemptCloseTask);
  $("task-save-btn").addEventListener("click", attemptCloseTask);
  taskDialog.addEventListener("cancel", (event) => {
    event.preventDefault(); // Esc: se comporta como cerrar con la X
    attemptCloseTask();
  });
  taskDialog.addEventListener("close", () => (draft = null)); // cierre forzado por el navegador: se descarta

  $("add-form").addEventListener("submit", (event) => {
    event.preventDefault();
    quickSave();
  });
  $("params-btn").addEventListener("click", () => openTaskDialog($("task-input").value.trim()));
  $("list-options-btn").addEventListener("click", () => openListDialog(state.currentListId));

  // Al cambiar de idioma se vuelve a dibujar lo que genera este archivo.
  I18n.onChange(() => {
    renderAll();
    if (settingsDialog.open) renderSettings();
    if (listDialog.open) renderListDialog();
    if (taskDialog.open && draft) renderTaskDialog();
  });

  // Las fechas relativas ("Mañana") cambian con el día: se refrescan cada minuto y al volver a la pestaña.
  setInterval(() => renderTasks(), 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) renderTasks();
  });

  saveState();
  renderAll();

  // Para pruebas desde la consola: Flucti.tasks.state(), Flucti.tasks.sortTasks(...)
  Flucti.tasks = {
    state: () => state,
    sortTasks,
    advanceRecurring,
    nextOccurrence,
    dateLabel,
    normalizeState,
    repeatSummary,
    renderAll,
  };
})();