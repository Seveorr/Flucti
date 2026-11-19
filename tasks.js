"use strict";

/* ==========================================================================
   tasks.js — tareas, listas y parámetros (todo se guarda en este dispositivo)

   Datos (localStorage "flucti:data:v1"):
     params: qué parámetros tiene una tarea (los que trae la app y los que añade el usuario)
     lists:  listas { id, name, hidden, showCompleted, sort }; name null = nombre por defecto ("Actual")
     tasks:  tareas { id, listId, kind, title, values, recurrence, done, completedAt, createdAt }

   Norma: ninguna actualización borra las tareas guardadas. Al cambiar el formato de los datos se
   guarda antes una copia de seguridad, y las tareas completadas se marcan en vez de eliminarse.
   ========================================================================== */
(() => {
  const { t, tn } = I18n;
  const { h, icon, uid, clone, dates, segmented, dropdown, datePicker, timePicker } = UI;
  const { toDateString, parseDateString, diffDays, todayString, addDays, addMonths, WEEK_ORDER, weekdayName } = dates;
  const $ = (id) => document.getElementById(id);

  const STORAGE_KEY = "flucti:data:v1";
  const STATE_VERSION = 2;
  const STRIKE_DELAY = 380; // tiempo que se ve la tarea tachada
  const LEAVE_DURATION = 320; // duración de la animación de salida

  /* ------------------------------------------------------------------------
     Fechas en pantalla
     ------------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------------
     Parámetros de las tareas
     Los que trae la app tienen una definición fija (BUILTIN); del usuario solo se guarda
     en qué tipos de tarea aparecen (once / recurring) y si son obligatorios.
     Todos se pueden quitar excepto el título. Al quitar un parámetro no se borra lo que ya
     tienen guardado las tareas: si se vuelve a añadir, reaparece.
     ------------------------------------------------------------------------ */
  const TYPES = ["text", "textarea", "number", "date", "select", "checkbox"];

  const BUILTIN = {
    title: { type: "text", kinds: ["once", "recurring"], locked: true }, // no se puede quitar ni hacer opcional
    description: { type: "textarea", kinds: ["once", "recurring"] },
    due: { type: "date", kinds: ["once"] },
    date: { type: "date", kinds: ["recurring"] },
    repeat: { type: "recurrence", kinds: ["recurring"], alwaysRequired: true },
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
     Estado: carga, normalización, copia de seguridad, migración y guardado
     ------------------------------------------------------------------------ */
  function defaultState() {
    const listId = uid();
    return {
      version: STATE_VERSION,
      params: DEFAULT_PARAMS.map((p) => ({ ...p })),
      lists: [{ id: listId, name: null, hidden: false, showCompleted: false, sort: clone(DEFAULT_SORT) }],
      currentListId: listId,
      tasks: [],
    };
  }

  // Deja los datos en el formato actual sin perder ninguna tarea.
  function normalizeState(data) {
    const base = defaultState();
    if (!data || typeof data !== "object") return base;

    const params = [];
    const seen = new Set();
    for (const p of Array.isArray(data.params) ? data.params : []) {
      if (!p || typeof p.id !== "string" || seen.has(p.id)) continue;
      const def = BUILTIN[p.id];
      if (def) {
        seen.add(p.id);
        params.push({
          id: p.id,
          once: def.kinds.includes("once") && (def.locked === true || p.once === true),
          recurring: def.kinds.includes("recurring") && (def.locked === true || p.recurring === true),
          required: def.locked === true || def.alwaysRequired === true || p.required === true,
        });
      } else if (TYPES.includes(p.type) && typeof p.name === "string" && p.name) {
        seen.add(p.id);
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
    if (!seen.has("title")) params.unshift({ ...DEFAULT_PARAMS[0] });

    const lists = (Array.isArray(data.lists) ? data.lists : [])
      .filter((l) => l && typeof l.id === "string")
      .map((l) => ({
        id: l.id,
        name: typeof l.name === "string" && l.name.trim() ? l.name : null,
        hidden: l.hidden === true,
        showCompleted: l.showCompleted === true,
        sort: Array.isArray(l.sort)
          ? l.sort.filter((s) => s && typeof s.by === "string" && (s.dir === "asc" || s.dir === "desc")).map((s) => ({ by: s.by, dir: s.dir }))
          : clone(DEFAULT_SORT),
      }));
    if (!lists.length) lists.push(base.lists[0]);
    if (lists.every((l) => l.hidden)) lists[0].hidden = false;

    // Las tareas nunca se descartan: si algún dato falta se rellena con un valor por defecto.
    const tasks = [];
    for (const x of Array.isArray(data.tasks) ? data.tasks : []) {
      if (!x || typeof x !== "object" || typeof x.id !== "string") continue;
      const recurring = x.kind === "recurring" && x.recurrence && typeof x.recurrence === "object";
      const task = {
        id: x.id,
        listId: lists.some((l) => l.id === x.listId) ? x.listId : lists[0].id,
        kind: recurring ? "recurring" : "once",
        title: typeof x.title === "string" && x.title.trim() ? x.title : "—",
        values: x.values && typeof x.values === "object" ? x.values : {},
        createdAt: Number.isFinite(x.createdAt) ? x.createdAt : Date.now(),
      };
      if (recurring) task.recurrence = x.recurrence;
      else if (x.done === true) {
        task.done = true;
        task.completedAt = Number.isFinite(x.completedAt) ? x.completedAt : task.createdAt;
      }
      tasks.push(task);
    }

    const current = lists.find((l) => l.id === data.currentListId && !l.hidden) || lists.find((l) => !l.hidden);
    return { version: STATE_VERSION, params, lists, currentListId: current.id, tasks };
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

  // Guarda una copia tal cual estaba antes de cambiar el formato de los datos (una sola vez por versión).
  function backup(raw, suffix) {
    try {
      const key = `${STORAGE_KEY}:${suffix}`;
      if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
    } catch {
      /* sin espacio o sin almacenamiento: no se puede hacer la copia */
    }
  }

  function loadState() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* se ignora */
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== STATE_VERSION) backup(raw, `backup-v${(parsed && parsed.version) || 0}`);
        return normalizeState(parsed);
      } catch {
        backup(raw, "corrupt"); // datos ilegibles: se conservan aparte antes de empezar de cero
      }
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
  const listName = (list) => list.name || t("list.default");
  const hasParam = (id) => state.params.some((p) => p.id === id);
  const recurringAvailable = () => hasParam("repeat"); // sin regla de repetición no hay tareas recurrentes nuevas

  // Parámetro con todos sus datos: nombre traducido, tipo, en qué tareas aparece y si es obligatorio.
  function paramInfo(p) {
    const def = BUILTIN[p.id];
    return {
      id: p.id,
      builtin: Boolean(def),
      type: def ? def.type : p.type,
      kinds: def ? def.kinds : ["once", "recurring"],
      locked: Boolean(def && def.locked),
      fixedRequired: Boolean(def && (def.locked || def.alwaysRequired)),
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

  // Criterios por los que se puede ordenar una lista (solo los de parámetros que existen).
  function sortCriteria() {
    const criteria = [];
    if (hasParam("due") || hasParam("date")) criteria.push({ id: "due", label: t("param.due"), kind: "date" });
    if (hasParam("planned")) criteria.push({ id: "planned", label: t("param.planned"), kind: "date" });
    if (hasParam("energy")) criteria.push({ id: "energy", label: t("param.energy"), kind: "level" });
    criteria.push({ id: "title", label: t("param.title"), kind: "text" }, { id: "created", label: t("sort.created"), kind: "created" });
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
    if (rec.mode === "weekdays") return WEEK_ORDER.filter((d) => rec.days.includes(d)).map((d) => weekdayName(d)).join(", ");
    if (rec.every === 1) return t(`repeat.summary.${rec.unit}`);
    return t("repeat.summary.many", { count: rec.every, unit: tn(`repeat.unit.${rec.unit}`, rec.every) });
  }

  const recurrenceValid = (rec) =>
    rec.mode === "weekdays" ? rec.days.length > 0 : Number.isInteger(rec.every) && rec.every >= 1 && rec.every <= 999;

  /* ------------------------------------------------------------------------
     Tareas en pantalla
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
      const extra = task.done ? "" : dueLabel.diff === 1 ? " meta-tomorrow" : dueLabel.diff < 0 ? " meta-overdue" : "";
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
    const tomorrow = !task.done && dueLabel && dueLabel.diff === 1; // las que vencen mañana se resaltan
    const item = h("li", {
      class: `task${entering ? " entering" : ""}${tomorrow ? " due-tomorrow" : ""}${task.done ? " is-completed" : ""}`,
      dataset: { id: task.id },
    });

    const checkbox = h("input", {
      type: "checkbox",
      class: "check",
      checked: task.done === true,
      "aria-label": t("task.complete", { name: task.title }),
      onchange: (event) => {
        if (task.done && !event.target.checked) restoreTask(task);
        else if (!task.done && event.target.checked) completeTask(task, item);
      },
    });
    const meta = metaItems(task, dueLabel);
    const body = h(
      "div",
      { class: "task-body" },
      h("span", {
        class: "task-name",
        text: task.title,
        onclick: (event) => {
          event.stopPropagation();
          openTaskDialogForEdit(task);
        },
      }),
      task.values.description ? h("span", { class: "task-desc", text: task.values.description }) : null,
      meta.length ? h("div", { class: "task-meta" }, meta) : null
    );
    item.append(h("div", { class: "task-row" }, h("div", { class: "task-content" }, checkbox, body)));
    return item;
  }

  // Las tareas únicas completadas se marcan (no se borran) y se muestran u ocultan según la lista.
  function completeTask(task, item) {
    item.classList.add("done");
    const list = state.lists.find((l) => l.id === task.listId);

    if (task.kind === "recurring") {
      advanceRecurring(task, todayString()); // vuelve a aparecer con su siguiente fecha
      saveState();
      setTimeout(() => renderGrid(), STRIKE_DELAY);
      return;
    }
    task.done = true;
    task.completedAt = Date.now();
    saveState();
    setTimeout(() => {
      if (list && list.showCompleted) {
        renderGrid();
        return;
      }
      item.classList.add("leaving");
      setTimeout(() => renderGrid(), LEAVE_DURATION);
    }, STRIKE_DELAY);
  }

  function restoreTask(task) {
    delete task.done;
    delete task.completedAt;
    saveState();
    renderGrid();
  }

  /* ------------------------------------------------------------------------
     Listas: una tarjeta por lista, con sus tareas dentro
     ------------------------------------------------------------------------ */
  const NEW_KEY = "__new__";
  const titleDrafts = new Map(); // texto escrito en el campo de cada lista (se conserva al redibujar)
  const inputs = new Map();
  let focusedKey = null; // campo que tiene el cursor (id de lista o NEW_KEY)
  let rendering = false;
  let addingList = false;
  let newListDraft = "";
  let newListInput = null;

  function trackFocus(input, key) {
    input.addEventListener("focus", () => (focusedKey = key));
    input.addEventListener("blur", () => {
      if (!rendering && focusedKey === key) focusedKey = null;
    });
  }

  const cleanTitle = (text) => text.trim().replace(/\s+/g, " ");

  // "Guardar": con solo el título se guarda al momento. Si falta un parámetro obligatorio, la tarea no se
  // pierde: se abre la ventana con el título escrito y se señala lo que falta para rellenarlo.
  function quickSave(list) {
    const input = inputs.get(list.id);
    const title = cleanTitle(input.value);
    if (!title) {
      input.classList.add("invalid"); // sin título no se guarda: el campo se señala en rojo
      input.focus();
      return;
    }
    const missing = paramsFor("once").filter((p) => p.id !== "title" && p.required);
    if (missing.length) {
      openTaskDialog(list, true);
      return;
    }
    const task = { id: uid(), listId: list.id, kind: "once", title, values: {}, createdAt: Date.now() };
    state.tasks.push(task);
    saveState();
    titleDrafts.delete(list.id);
    focusedKey = list.id;
    renderGrid(task.id);
  }

  function addRow(list) {
    const input = h("input", {
      class: "add-input",
      type: "text",
      maxlength: 120,
      placeholder: t("task.input.placeholder"),
      "aria-label": t("task.input.label"),
      value: titleDrafts.get(list.id) || "",
      oninput: (event) => {
        titleDrafts.set(list.id, event.target.value);
        event.target.classList.remove("invalid");
      },
    });
    trackFocus(input, list.id);
    inputs.set(list.id, input);
    return h(
      "form",
      { class: "add", autocomplete: "off", onsubmit: (event) => (event.preventDefault(), quickSave(list)) },
      input,
      h("button", { class: "square-btn primary", type: "submit", "aria-label": t("task.save") }, icon("plus", 22)),
      h("button", { class: "square-btn", type: "button", "aria-haspopup": "dialog", "aria-label": t("task.params"), onclick: () => openTaskDialog(list) }, icon("sliders", 22))
    );
  }

  function buildCard(list, enteringId) {
    const pending = sortTasks(state.tasks.filter((x) => x.listId === list.id && !x.done), list.sort);
    const completed = list.showCompleted
      ? state.tasks.filter((x) => x.listId === list.id && x.done).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      : [];

    return h(
      "section",
      { class: "list-card", dataset: { list: list.id }, "aria-label": listName(list) },
      h(
        "header",
        { class: "card-head" },
        h("h2", { class: "card-title", text: listName(list) }),
        pending.length ? h("span", { class: "card-count", text: String(pending.length) }) : null,
        h(
          "button",
          { class: "icon-btn", type: "button", "aria-haspopup": "dialog", "aria-label": `${t("list.options")}: ${listName(list)}`, onclick: () => openListDialog(list.id) },
          icon("dots", 22)
        )
      ),
      addRow(list),
      h("ul", { class: "list" }, pending.map((x) => taskElement(x, x.id === enteringId))),
      h("p", { class: "card-empty", text: t("task.empty"), hidden: pending.length > 0 }),
      completed.length
        ? h(
          "div",
          { class: "completed" },
          h("h3", { class: "completed-title", text: `${t("task.completed.title")} · ${completed.length}` }),
          h("ul", { class: "list" }, completed.map((x) => taskElement(x, false)))
        )
        : null
    );
  }

  function createList(name) {
    state.lists.push({ id: uid(), name, hidden: false, showCompleted: false, sort: clone(DEFAULT_SORT) });
    saveState();
    renderGrid();
  }

  // Última "tarjeta": un recuadro para crear otra lista (se convierte en un campo para el nombre).
  function newListCard() {
    if (!addingList) {
      return h(
        "button",
        {
          class: "list-card list-card-add",
          type: "button",
          "aria-label": t("list.add"),
          onclick: () => {
            addingList = true;
            focusedKey = NEW_KEY;
            renderGrid();
          },
        },
        icon("plus", 20),
        h("span", { text: t("list.new.placeholder") })
      );
    }
    const input = h("input", {
      class: "add-input",
      type: "text",
      maxlength: 30,
      placeholder: t("list.new.placeholder"),
      "aria-label": t("list.new.placeholder"),
      value: newListDraft,
      oninput: (event) => (newListDraft = event.target.value),
    });
    let finished = false;
    const finish = (create) => {
      if (finished) return;
      finished = true;
      addingList = false;
      focusedKey = null;
      const name = cleanTitle(input.value);
      newListDraft = "";
      if (create && name) createList(name);
      else renderGrid();
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finish(true);
      } else if (event.key === "Escape") {
        finish(false);
      }
    });
    input.addEventListener("blur", () => {
      if (!rendering) finish(true); // al salir se crea si hay nombre
    });
    trackFocus(input, NEW_KEY);
    newListInput = input;
    return h("div", { class: "list-card list-card-new" }, input);
  }

  function renderGrid(enteringId) {
    rendering = true;
    const restore = focusedKey;
    inputs.clear();
    newListInput = null;
    const cards = visibleLists().map((list) => buildCard(list, enteringId));
    // Dos columnas: la primera mitad de las listas a la izquierda (de arriba abajo) y el resto a la derecha,
    // sin huecos entre unas y otras. El recuadro de "Nueva lista" va al final de la columna derecha.
    // En pantallas pequeñas las columnas se funden y queda una sola lista por fila, en el mismo orden.
    const half = Math.ceil(cards.length / 2);
    $("lists-grid").replaceChildren(
      h("div", { class: "lists-col" }, cards.slice(0, half)),
      h("div", { class: "lists-col" }, cards.slice(half), newListCard())
    );
    rendering = false;

    const el = restore === NEW_KEY ? newListInput : restore ? inputs.get(restore) : null;
    if (el) {
      el.focus();
      if (el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
    }
  }

  /* ------------------------------------------------------------------------
     Ventana de la tarea (parámetros)
     Cerrarla guarda la tarea; sin título se descarta; si falta un campo obligatorio no se guarda
     y se avisa de cuál es.
     ------------------------------------------------------------------------ */
  let draft = null; // { listId, kind, values, recurrence, showErrors, editingTaskId }

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
  const titleEmpty = () => !(draft.values.title || "").trim();

  // Sin título la tarea se descarta: se avisa en rojo mientras esté vacío. Si faltan parámetros obligatorios, se dice cuáles.
  const titleGroup = () => $("task-fields").querySelector('[data-param="title"]');

  function refreshTaskError() {
    const group = titleGroup();
    if (group) group.classList.toggle("invalid", draft.showErrors && titleEmpty());
    const missing = draft.showErrors ? missingParams() : [];
    let text = "";
    if (draft.showErrors && titleEmpty()) text = t("task.error.title");
    else if (missing.length) text = t("task.error.missing", { names: missing.map((p) => p.name).join(", ") });
    $("task-error").textContent = text;
  }

  function dateControl(info) {
    const v = draft.values[info.id] || (draft.values[info.id] = { date: "", time: "" });
    const time = timePicker({
      value: v.time,
      label: t("field.time"),
      placeholder: t("field.time"),
      disabled: !v.date,
      onChange: (value) => (v.time = value),
    });
    const date = datePicker({
      value: v.date,
      label: info.name,
      placeholder: t("field.date"),
      onChange: (value) => {
        v.date = value;
        time.picker.setDisabled(!value);
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
          date.picker.set("");
          time.picker.set("");
          time.picker.setDisabled(true);
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
        const unitHost = h("div", { class: "repeat-unit" });
        const paintUnit = () =>
          unitHost.replaceChildren(
            dropdown({
              value: rec.unit,
              label: t("repeat.every"),
              options: ["day", "week", "month", "year"].map((unit) => ({ value: unit, label: tn(`repeat.unit.${unit}`, rec.every) })),
              onChange: (unit) => (rec.unit = unit),
            })
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
            paintUnit(); // "día" / "días" según el número
          },
        });
        paintUnit();
        detail = h("div", { class: "repeat-row" }, h("span", { class: "repeat-label", text: t("repeat.every") }), amount, unitHost);
      } else {
        detail = h(
          "div",
          { class: "weekdays", role: "group" },
          WEEK_ORDER.map((day) => {
            const chip = h("button", { type: "button", class: "day-chip", "aria-pressed": String(rec.days.includes(day)), text: weekdayName(day) });
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
    const missing = draft.showErrors && info.id !== "title" && isMissing(info);
    const group = h("div", { class: `field-group${missing ? " invalid" : ""}`, dataset: { param: info.id } });
    const inputId = `task-field-${info.id}`;
    const label = (tag = "label") => h(tag, { class: "field-label", for: tag === "label" ? inputId : null, text: info.name });
    const value = draft.values[info.id];
    const store = (v) => (draft.values[info.id] = v);

    if (info.type === "textarea") {
      group.append(label(), h("textarea", { class: "field", id: inputId, rows: 3, maxlength: 1000, value: value || "", oninput: (e) => store(e.target.value) }));
    } else if (info.type === "text" || info.type === "number") {
      const props = {
        class: "field",
        id: inputId,
        type: info.type === "number" ? "number" : "text",
        value: value ?? "",
        oninput: (e) => {
          store(e.target.value);
          if (info.id === "title") refreshTaskError();
        },
      };
      if (info.type === "number") Object.assign(props, { inputmode: "decimal", step: "any" });
      else props.maxlength = info.id === "title" ? 120 : 200;
      if (info.id === "title") {
        props.onkeydown = (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            attemptCloseTask(true);
          }
        };
      }
      group.append(label(), h("input", props));
    } else if (info.type === "select") {
      const options = [{ value: "", label: t("field.none") }, ...(info.options || []).map((o) => ({ value: o, label: optionLabel(info, o) }))];
      group.append(label("div"), dropdown({ value: value || "", options, label: info.name, onChange: store }));
    } else if (info.type === "checkbox") {
      group.append(h("label", { class: "check-row" }, h("input", { type: "checkbox", checked: Boolean(value), onchange: (e) => store(e.target.checked) }), info.name));
    } else if (info.type === "date") {
      group.append(label("div"), dateControl(info));
    } else if (info.type === "recurrence") {
      group.append(label("div"), recurrenceControl());
    }
    return group;
  }

  function renderTaskFields() {
    $("task-fields").replaceChildren(...paramsFor(draft.kind).map(buildField));
    refreshTaskError();
  }

  function renderTaskDialog() {
    if (!recurringAvailable()) draft.kind = "once";
    $("task-kind").replaceChildren(
      ...(recurringAvailable()
        ? [
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
          }),
        ]
        : [])
    );
    renderTaskFields();
  }

  function openTaskDialog(list, showErrors = false) {
    const title = cleanTitle(inputs.get(list.id) ? inputs.get(list.id).value : "");
    $("task-dialog-title").textContent = t("task.dialog.new");
    draft = {
      listId: list.id,
      kind: "once",
      values: { title },
      recurrence: { mode: "interval", every: 1, unit: "week", days: [] },
      showErrors, // true: se abre ya señalando los parámetros obligatorios que faltan
    };
    $("task-dialog-list").textContent = listName(list);
    renderTaskDialog();
    Flucti.openDialog($("task-dialog"));
  }

  function openTaskDialogForEdit(task) {
    const list = state.lists.find((l) => l.id === task.listId);

    draft = {
      listId: task.listId,
      kind: task.kind,
      values: clone(task.values || {}),
      recurrence: clone(
        task.recurrence || {
          mode: "interval",
          every: 1,
          unit: "week",
          days: [],
        }
      ),
      showErrors: false,
      editingTaskId: task.id,
    };

    draft.values.title = task.title;

    $("task-dialog-list").textContent = list ? listName(list) : "";
    $("task-dialog-title").textContent = t("task.dialog.edit");

    renderTaskDialog();
    Flucti.openDialog($("task-dialog"));
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
      listId: draft.listId,
      kind,
      title: cleanTitle(draft.values.title),
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

  // Cerrar con la cruz guarda la tarea si está completa; sin título se descarta automáticamente.
  // "Guardar" (o Enter en el título) sin título no descarta nada: deja la ventana abierta señalándolo en rojo.
  function attemptCloseTask(viaSave = false) {
    if (!draft) {
      $("task-dialog").close();
      return;
    }
    const listId = draft.listId;
    if (titleEmpty()) {
      draft.showErrors = true;
      refreshTaskError();

      if (viaSave) {
        const input = titleGroup() && titleGroup().querySelector("input");
        if (input) input.focus();
        return;
      }

      closeTaskDialog();
      titleDrafts.delete(listId);
      renderGrid();
      return;
    }
    if (missingParams().length) {
      draft.showErrors = true;
      renderTaskFields();
      return;
    }
    const task = taskFromDraft();

    if (draft.editingTaskId) {
      const index = state.tasks.findIndex((x) => x.id === draft.editingTaskId);

      if (index !== -1) {
        const oldTask = state.tasks[index];

        state.tasks[index] = {
          ...task,
          id: oldTask.id,
          createdAt: oldTask.createdAt,
          ...(oldTask.done ? { done: true, completedAt: oldTask.completedAt } : {}),
        };
      }
    } else {
      state.tasks.push(task);
    }

    saveState();
    closeTaskDialog();
    titleDrafts.delete(listId);
    renderGrid(task.id);
  }

  /* ------------------------------------------------------------------------
     Ajustes: un menú con dos apartados (parámetros de las tareas y listas)
     ------------------------------------------------------------------------ */
  let settingsView = null; // null (menú), "params" o "lists"
  let paramForm = null; // formulario de "Añadir parámetro" (null = cerrado)
  const newParamForm = () => ({ name: "", type: "text", options: "", once: true, recurring: true, required: false, error: false });

  function afterParamsChange() {
    saveState();
    renderGrid();
    if ($("task-dialog").open && draft) renderTaskFields();
  }

  function paramCheck(p, info, field, label) {
    if (field !== "required" && !info.kinds.includes(field)) return h("span", { class: "param-na", "aria-hidden": "true", text: "–" });
    const fixed = field === "required" ? info.fixedRequired : info.locked;
    return h("input", {
      type: "checkbox",
      class: "param-check",
      checked: fixed ? true : p[field],
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
    return h(
      "div",
      { class: "param-row" },
      h("div", { class: "param-name" }, h("span", { text: info.name }), h("small", { text: t(`type.${info.type}`) })),
      h("div", { class: "param-cell" }, paramCheck(p, info, "once", t("kind.once"))),
      h("div", { class: "param-cell" }, paramCheck(p, info, "recurring", t("kind.recurring"))),
      h("div", { class: "param-cell" }, paramCheck(p, info, "required", t("param.required"))),
      info.locked
        ? h("span")
        : h(
          "button",
          {
            class: "icon-btn small",
            type: "button",
            "aria-label": `${t("param.remove")}: ${info.name}`,
            onclick: () => {
              state.params = state.params.filter((x) => x.id !== p.id); // los datos de las tareas se conservan
              afterParamsChange();
              renderSettings();
            },
          },
          icon("trash", 16)
        )
    );
  }

  // Vuelve a poner un parámetro predefinido que se quitó, en su sitio.
  function restoreParam(id) {
    const def = DEFAULT_PARAMS.find((p) => p.id === id);
    if (!def || hasParam(id)) return;
    const order = DEFAULT_PARAMS.map((p) => p.id);
    const later = order.slice(order.indexOf(id) + 1);
    const at = state.params.findIndex((p) => later.includes(p.id));
    if (at === -1) state.params.push({ ...def });
    else state.params.splice(at, 0, { ...def });
    afterParamsChange();
    renderSettings();
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
    const typeSelect = dropdown({
      value: f.type,
      label: t("param.type"),
      options: TYPES.map((type) => ({ value: type, label: t(`type.${type}`) })),
      onChange: (type) => {
        f.type = type;
        options.hidden = type !== "select";
      },
    });
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

    const removed = DEFAULT_PARAMS.filter((d) => !hasParam(d.id));
    return h(
      "section",
      { class: "settings-section" },
      h("p", { class: "settings-hint", text: t("settings.params.hint") }),
      grid,
      removed.length
        ? h(
          "div",
          { class: "removed" },
          h("p", { class: "settings-hint", text: t("settings.params.restore") }),
          h(
            "div",
            { class: "chip-row" },
            removed.map((d) => h("button", { class: "chip", type: "button", onclick: () => restoreParam(d.id) }, icon("plus", 14), t(`param.${d.id}`)))
          )
        )
        : null,
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
    renderGrid();
    renderSettings();
  }

  function listsSection() {
    return h(
      "section",
      { class: "settings-section" },
      state.lists.map((list) => {
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
      })
    );
  }

  function aboutSection() {
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };

    const wrapper = el("div", "about-section");

    // Cabecera principal
    const hero = el("div", "about-hero");
    hero.append(
      el("span", "about-badge", t("about.badge")),
      el("h3", "about-heading", t("about.title")),
      el("p", "about-lead", t("about.description"))
    );

    // Qué es Flucti
    const whatIsCard = el("div", "about-card");
    whatIsCard.append(
      el("h4", "about-card-title", t("about.whatIs.title")),
      el("p", "about-text", t("about.whatIs.text")),
      el("p", "about-note", t("about.storage.text"))
    );

    // Funciones clave
    const featuresBlock = el("div", "about-block");
    featuresBlock.append(el("h4", "about-card-title", t("about.features.title")));

    const grid = el("div", "about-grid");
    const featureItems = [
      { icon: "🌤️", title: "about.features.sky.title", desc: "about.features.sky.desc" },
      { icon: "📋", title: "about.features.lists.title", desc: "about.features.lists.desc" },
      { icon: "🔁", title: "about.features.tasks.title", desc: "about.features.tasks.desc" },
      { icon: "⚙️", title: "about.features.params.title", desc: "about.features.params.desc" },
      { icon: "🌍", title: "about.features.i18n.title", desc: "about.features.i18n.desc" },
      { icon: "🛡️", title: "about.features.backups.title", desc: "about.features.backups.desc" }
    ];

    featureItems.forEach(({ icon, title, desc }) => {
      const item = el("div", "about-feature-item");
      const head = el("div", "about-feature-head");
      head.append(
        el("span", "about-feature-icon", icon),
        el("strong", "about-feature-title", t(title))
      );
      item.append(head, el("p", "about-feature-desc", t(desc)));
      grid.append(item);
    });

    featuresBlock.append(grid);

    // Línea del tiempo de versiones desplegables
    const changelogBlock = el("div", "about-block about-changelog");
    changelogBlock.append(
      el("h4", "about-card-title", t("about.changelog.title")),
      el("p", "about-note", t("about.changelog.subtitle"))
    );

    const timeline = el("div", "about-timeline");
    const releases = [
      {
        versionKey: "about.versions.v001.label",
        dateKey: "about.versions.v001.date",
        titleKey: "about.versions.v001.title",
        bodyKey: "about.versions.v001.body",
        openByDefault: false
      },
      {
        versionKey: "about.versions.v002.label",
        dateKey: "about.versions.v002.date",
        titleKey: "about.versions.v002.title",
        bodyKey: "about.versions.v002.body",
        openByDefault: false
      },
      {
        versionKey: "about.versions.v003.label",
        dateKey: "about.versions.v003.date",
        titleKey: "about.versions.v003.title",
        bodyKey: "about.versions.v003.body",
        openByDefault: false
      },
      {
        versionKey: "about.versions.v004.label",
        dateKey: "about.versions.v004.date",
        titleKey: "about.versions.v004.title",
        bodyKey: "about.versions.v004.body",
        openByDefault: false
      },
      {
        versionKey: "about.versions.v005.label",
        dateKey: "about.versions.v005.date",
        titleKey: "about.versions.v005.title",
        bodyKey: "about.versions.v005.body",
        openByDefault: false
      }
    ];

    releases.forEach(({ versionKey, dateKey, titleKey, bodyKey, openByDefault }) => {
      const entry = el("details", "about-timeline-item");
      if (openByDefault) entry.open = true;

      const summary = el("summary", "about-timeline-summary");
      const headerRow = el("span", "about-timeline-header");
      headerRow.append(
        el("strong", "about-timeline-version", t(versionKey)),
        el("span", "about-timeline-date", t(dateKey))
      );

      // Aquí se crea y se añade el punto (<span class="about-timeline-dot"></span>)
      summary.append(
        el("span", "about-timeline-dot"),
        headerRow
      );

      const content = el("div", "about-timeline-content");
      content.append(
        el("h5", "about-timeline-title", t(titleKey)),
        el("p", "about-text", t(bodyKey))
      );

      entry.append(summary, content);
      timeline.append(entry);
    });

    changelogBlock.append(timeline);

    // Próximos pasos / futuro
    const futureCard = el("div", "about-card about-card--future");
    futureCard.append(
      el("h4", "about-card-title", t("about.future.title")),
      el("p", "about-text", t("about.future.text"))
    );

    // Créditos
    const aboutMeCard = el("div", "about-card about-card--credits");
    aboutMeCard.append(
      el("p", "about-card-title", t("about.me.title")),
      el("p", "about-card-title", t("about.me.description")),
      el("h5", "about-text", t("about.me.contact"))
    );
    const creditsCard = el("div", "about-card about-card--credits");
    creditsCard.append(
      el("h4", "about-card-title", t("about.credits.title")),
      el("p", "about-text", t("about.credits.weather")),
      el("p", "about-text", t("about.credits.font")),
      el("p", "about-meta", t("about.credits.defaultLocation"))
    );

    wrapper.append(hero, whatIsCard, featuresBlock, changelogBlock, futureCard, aboutMeCard, creditsCard);
    return wrapper;
  }

  function settingsMenu() {
    return h(
      "div",
      { class: "settings-menu" },
      ["params", "lists", "about"].map((view) =>
        h(
          "button",
          {
            class: "menu-row",
            type: "button",
            onclick: () => {
              settingsView = view;
              renderSettings();
            },
          },
          h(
            "span",
            {
              text: t(
                view === "params"
                  ? "settings.params"
                  : view === "lists"
                    ? "settings.lists"
                    : "settings.about"
              ),
            }
          ),
          icon("chevron", 18)
        )
      )
    );
  }

  function renderSettings() {
    $("settings-back").hidden = settingsView === null;
    $("settings-title").textContent =
      settingsView === "params"
        ? t("settings.params")
        : settingsView === "lists"
          ? t("settings.lists")
          : settingsView === "about"
            ? t("settings.about")
            : t("menu.title");

    $("settings-body").replaceChildren(
      settingsView === "params"
        ? paramsSection()
        : settingsView === "lists"
          ? listsSection()
          : settingsView === "about"
            ? aboutSection()
            : settingsMenu()
    );
  }

  /* ------------------------------------------------------------------------
     Ventana de una lista: nombre, orden, tareas completadas, ocultar y eliminar
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

  // Una fila de criterio de orden. "rules" son los criterios disponibles de la lista, "index" su posición.
  function sortRow(list, rules, index, criteria) {
    const rule = rules[index];
    const kindOf = (id) => (criteria.find((c) => c.id === id) || { kind: "text" }).kind;
    const changed = () => {
      saveState();
      renderGrid();
      renderListDialog();
    };
    return h(
      "div",
      { class: "sort-row" },
      dropdown({
        value: rule.by,
        label: t("list.sort"),
        options: criteria.map((c) => ({ value: c.id, label: c.label })),
        onChange: (by) => {
          rule.by = by;
          rule.dir = defaultDirection(kindOf(by));
          changed();
        },
      }),
      dropdown({
        value: rule.dir,
        label: t("list.sort"),
        options: ["asc", "desc"].map((dir) => ({ value: dir, label: t(`dir.${kindOf(rule.by)}.${dir}`) })),
        onChange: (dir) => {
          rule.dir = dir;
          changed();
        },
      }),
      index > 0
        ? h(
          "button",
          {
            class: "icon-btn small",
            type: "button",
            "aria-label": t("sort.up"),
            onclick: () => {
              const a = list.sort.indexOf(rules[index - 1]);
              const b = list.sort.indexOf(rule);
              [list.sort[a], list.sort[b]] = [list.sort[b], list.sort[a]];
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
            list.sort.splice(list.sort.indexOf(rule), 1);
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
    titleDrafts.delete(id);
    if (!visibleLists().length) state.lists[0].hidden = false;
    saveState();
    $("list-dialog").close();
    renderGrid();
    if ($("settings-dialog").open) renderSettings();
  }

  function renderListDialog() {
    const list = state.lists.find((l) => l.id === editingListId);
    if (!list) return;
    const criteria = sortCriteria();
    // los criterios de parámetros que ya no existen se saltan (se conservan por si el parámetro vuelve)
    const rules = list.sort.filter((r) => criteria.some((c) => c.id === r.by));
    const unused = criteria.find((c) => !rules.some((r) => r.by === c.id));
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
        renderGrid();
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
        ...rules.map((_, i) => sortRow(list, rules, i, criteria)),
        unused
          ? h("button", {
            class: "text-btn",
            type: "button",
            text: t("sort.add"),
            onclick: () => {
              list.sort.push({ by: unused.id, dir: defaultDirection(unused.kind) });
              saveState();
              renderGrid();
              renderListDialog();
            },
          })
          : null
      ),
      h(
        "div",
        { class: "check-group stacked" },
        h(
          "label",
          { class: "check-row" },
          h("input", {
            type: "checkbox",
            checked: list.showCompleted,
            onchange: (event) => {
              list.showCompleted = event.target.checked;
              saveState();
              renderGrid();
            },
          }),
          t("list.showCompleted")
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
        )
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
  Flucti.bindDialog(taskDialog);

  $("menu-btn").addEventListener("click", () => {
    settingsView = null;
    paramForm = null;
    renderSettings();
    Flucti.openDialog(settingsDialog);
  });
  $("settings-back").addEventListener("click", () => {
    settingsView = null;
    paramForm = null;
    renderSettings();
  });
  $("settings-close").addEventListener("click", () => settingsDialog.close());
  $("list-close").addEventListener("click", () => listDialog.close());
  listDialog.addEventListener("close", () => {
    renderGrid();
    if (settingsDialog.open) renderSettings();
  });

  $("task-close").addEventListener("click", () => attemptCloseTask(false));
  $("task-save-btn").addEventListener("click", () => attemptCloseTask(true));
  taskDialog.addEventListener("close", () => {
    if (draft && !draft.editingTaskId && (draft.values.title || "").trim()) {
      titleDrafts.set(draft.listId, cleanTitle(draft.values.title));
      draft = null;
      renderGrid();
    }

    draft = null;
    $("task-dialog-title").textContent = t("task.dialog.new");
  });
  // Al cambiar de idioma se vuelve a dibujar lo que genera este archivo.
  I18n.onChange(() => {
    renderGrid();
    if (settingsDialog.open) renderSettings();
    if (listDialog.open) renderListDialog();
    if (taskDialog.open && draft) renderTaskDialog();
  });

  // Las fechas relativas ("Mañana") cambian con el día: se refrescan cada minuto y al volver a la pestaña,
  // sin interrumpir si se está escribiendo o hay una ventana abierta.
  const refresh = () => {
    if (!focusedKey && !Flucti.isDialogOpen()) renderGrid();
  };
  setInterval(refresh, 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });

  saveState();
  renderGrid();

  // Para pruebas desde la consola: Flucti.tasks.state(), Flucti.tasks.sortTasks(...)
  Flucti.tasks = {
    state: () => state,
    sortTasks,
    advanceRecurring,
    nextOccurrence,
    dateLabel,
    normalizeState,
    repeatSummary,
    renderGrid,
  };
})();