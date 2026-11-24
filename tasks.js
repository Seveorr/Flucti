"use strict";

/* ==========================================================================
   tasks.js — tareas, listas y parámetros (todo se guarda en este dispositivo)

   Datos (localStorage "flucti:data:v1"):
     params: parámetros por defecto: los que reciben las listas nuevas
     lists:  listas { id, kind, name, hidden, showCompleted, sort, params, layout, highlight, links, filter }; name null = nombre por defecto ("Actual")
             kind: "own" (independiente: tiene sus propias tareas) o "linked" (dependiente: no guarda tareas, muestra
             las de otras listas independientes)
             links: (dependientes) [{ listId }]; sus parámetros no se crean: son todos los distintos de las listas de origen
             filter: (dependientes) requisitos sobre los parámetros de esta lista: { match, groups: [{ match, conditions }] }
             (cada grupo une sus condiciones con Y/"all" u O/"any"; "match" une los grupos entre sí)
             params: los parámetros de esa lista (cada una tiene los suyos); el que lleva ref: true es el referente de la lista
             (el que se escribe en el recuadro de la lista y da nombre a las tareas; por defecto, el título)
             layout: cómo se ve cada parámetro en la lista y en qué orden { id, style, color }
             highlight: qué tareas se resaltan { match, groups: [{ match, conditions: [{ param, op, value }] }], color, blink }
             (el orden del array es el orden en que se ven las listas)
     tasks:  tareas { id, listId, kind, title, values, recurrence, done, completedAt, createdAt }

   Norma: ninguna actualización borra las tareas guardadas. Al cambiar el formato de los datos se
   guarda antes una copia de seguridad, y las tareas completadas se marcan en vez de eliminarse.
   ========================================================================== */
(() => {
  const { t, tn } = I18n;
  const { h, icon, uid, clone, dates, segmented, dropdown, datePicker, timePicker, richEditor, richHtml, richPlain } = UI;
  const { toDateString, parseDateString, diffDays, todayString, addDays, addMonths, WEEK_ORDER, weekdayName } = dates;
  const $ = (id) => document.getElementById(id);

  const STORAGE_KEY = "flucti:data:v1";
  const STATE_VERSION = 4;
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
    title: { type: "text", kinds: ["once", "recurring"] }, // por defecto es el referente de la lista: mientras lo sea no se puede quitar ni hacer opcional
    description: { type: "textarea", kinds: ["once", "recurring"] },
    due: { type: "date", kinds: ["once"] },
    date: { type: "date", kinds: ["recurring"] },
    repeat: { type: "recurrence", kinds: ["recurring"], alwaysRequired: true },
    planned: { type: "date", kinds: ["once", "recurring"] },
    source: { type: "text", kinds: ["once", "recurring"] }, // solo en las dependientes: nombre de la lista de la que viene la tarea
    energy: { type: "select", kinds: ["once", "recurring"] }, // sus opciones se editan como las de cualquier lista desplegable
  };

  // Por defecto: descripción, vencimiento (hora opcional), planificación (opcional) y energía.
  const DEFAULT_PARAMS = [
    { id: "title", once: true, recurring: true, required: true, ref: true },
    { id: "description", once: true, recurring: true, required: false },
    { id: "due", once: true, recurring: false, required: false },
    { id: "date", once: false, recurring: true, required: true },
    { id: "repeat", once: false, recurring: true, required: true },
    { id: "planned", once: true, recurring: true, required: false },
    { id: "energy", once: true, recurring: true, required: false },
  ];

  // Opciones de la energía al empezar, de más a menos. Se pueden cambiar, quitar y añadir otras.
  const DEFAULT_ENERGY = [
    { id: "high", color: "#dc2626" },
    { id: "medium", color: "#ca8a04" },
    { id: "low", color: "#16a34a" },
  ];
  const DEFAULT_SORT = [
    { by: "due", dir: "asc" }, // primero las que vencen antes
    { by: "energy", dir: "desc" }, // y, a igual fecha, las que más energía suponen
  ];

  // Resaltado: las tareas que cumplen las condiciones se pintan de un color (o parpadean). Por defecto, las que vencen mañana.
  // color: "auto" (el del tema) o un color #rrggbb. Las condiciones van en grupos: dentro de cada grupo se cumplen todas
  // ("all", Y) o alguna ("any", O) y, entre grupos, también ("match" de la raíz).
  const DEFAULT_HIGHLIGHT = { match: "all", color: "auto", blink: false, groups: [{ match: "all", conditions: [{ param: "due", op: "inDays", value: 1 }] }] };
  const HL_OPS = {
    date: ["overdue", "today", "inDays", "withinDays", "empty", "notEmpty"],
    select: ["is", "isNot", "empty", "notEmpty"],
    text: ["contains", "empty", "notEmpty"],
    number: ["gt", "lt", "eq", "empty", "notEmpty"],
    checkbox: ["checked", "unchecked"],
  };
  const HL_NEEDS = { inDays: "number", withinDays: "number", is: "select", isNot: "select", contains: "text", gt: "number", lt: "number", eq: "number" };
  const hlGroup = (type) => (type === "textarea" ? "text" : type);

  // Cómo se ve un parámetro en las tareas de una lista: título, descripción, dato (texto pequeño),
  // etiqueta (palabra con contorno), etiqueta de color (rellena) u oculto.
  const STYLES = ["title", "description", "meta", "tag", "badge", "hidden"];
  const PALETTE = ["#2563eb", "#0d9488", "#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#c026d3", "#64748b"];
  const DEFAULT_COLOR = PALETTE[0];
  const isColor = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
  const defaultStyle = (id, ref = false) => (ref || id === "title" ? "title" : id === "description" ? "description" : id === "source" ? "tag" : "meta");

  // Color del texto que se lee bien sobre un fondo (blanco u oscuro según lo claro que sea).
  function inkFor(color) {
    const n = parseInt(color.slice(1), 16);
    const luminance = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    return luminance > 0.6 ? "#1e293b" : "#ffffff";
  }
  /* ------------------------------------------------------------------------
     Estado: carga, normalización, copia de seguridad, migración y guardado
     ------------------------------------------------------------------------ */
  // Una lista nueva empieza con los parámetros por defecto (una copia: cambiar los de una lista no toca los demás).
  function makeList({ id = uid(), name = null, params = DEFAULT_PARAMS, kind = "own" } = {}) {
    return {
      id,
      kind,
      name,
      links: [],
      filter: { match: "all", groups: [] },
      hidden: false,
      showCompleted: false,
      sort: clone(DEFAULT_SORT),
      params: clone(params),
      layout: params.map((p) => ({ id: p.id, style: defaultStyle(p.id, p.ref === true), color: DEFAULT_COLOR })),
      highlight: clone(DEFAULT_HIGHLIGHT),
    };
  }

  function defaultState() {
    const list = makeList();
    return {
      version: STATE_VERSION,
      params: DEFAULT_PARAMS.map((p) => ({ ...p })),
      lists: [list],
      currentListId: list.id,
      tasks: [],
    };
  }

  // Opciones de una lista desplegable: { id, label, color }. Las guardadas como texto (versiones anteriores)
  // pasan a objetos con el mismo texto como id, para que los valores de las tareas sigan valiendo.
  // En la energía el nombre es opcional: sin él se usa el texto traducido.
  function normalizeOptions(raw, fallback) {
    const options = [];
    const seen = new Set();
    for (const o of Array.isArray(raw) ? raw : []) {
      const id = typeof o === "string" ? o : o && typeof o.id === "string" ? o.id : "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const label = typeof o === "string" ? o : typeof o.label === "string" && o.label.trim() ? o.label : null;
      const color = o && isColor(o.color) ? o.color : PALETTE[options.length % PALETTE.length];
      options.push(label ? { id, label, color } : fallback ? { id, color } : { id, label: id, color });
    }
    return options.length || !fallback ? options : clone(fallback);
  }

  // Parámetros válidos de una lista o de los de por defecto. Siempre hay uno (y solo uno) que es el referente:
  // un parámetro de texto o de texto largo (por defecto, el título).
  function normalizeParams(raw) {
    const params = [];
    const seen = new Set();
    for (const p of Array.isArray(raw) ? raw : []) {
      if (!p || typeof p.id !== "string" || seen.has(p.id)) continue;
      const def = BUILTIN[p.id];
      if (def) {
        seen.add(p.id);
        const entry = {
          id: p.id,
          once: def.kinds.includes("once") && p.once === true,
          recurring: def.kinds.includes("recurring") && p.recurring === true,
          required: def.alwaysRequired === true || p.required === true,
        };
        if (p.ref === true) entry.ref = true;
        if (def.type === "select") entry.options = normalizeOptions(p.options, DEFAULT_ENERGY);
        params.push(entry);
      } else if (TYPES.includes(p.type) && typeof p.name === "string" && p.name) {
        seen.add(p.id);
        const entry = {
          id: p.id,
          type: p.type,
          name: p.name,
          options: p.type === "select" ? normalizeOptions(p.options) : undefined,
          once: p.once === true,
          recurring: p.recurring === true,
          required: p.required === true,
        };
        if (p.ref === true) entry.ref = true;
        params.push(entry);
      }
    }

    // Referente: el marcado (si sigue siendo de texto), si no el título y, si no, el primer parámetro de texto.
    const textual = (p) => p.id !== "source" && ["text", "textarea"].includes(BUILTIN[p.id] ? BUILTIN[p.id].type : p.type);
    let ref = params.find((p) => p.ref && textual(p)) || params.find((p) => p.id === "title") || params.find(textual);
    if (!ref) {
      ref = { ...DEFAULT_PARAMS[0] };
      params.unshift(ref);
    }
    for (const p of params) delete p.ref;
    Object.assign(ref, { ref: true, once: true, recurring: true, required: true });
    return params;
  }

  // Aspecto guardado de los parámetros de una lista: orden, estilo y color (lo que falte lo completa layoutOf).
  function normalizeLayout(raw) {
    const layout = [];
    const seen = new Set();
    for (const e of Array.isArray(raw) ? raw : []) {
      if (!e || typeof e.id !== "string" || seen.has(e.id) || !STYLES.includes(e.style)) continue;
      seen.add(e.id);
      layout.push({ id: e.id, style: e.style, color: isColor(e.color) ? e.color : DEFAULT_COLOR });
    }
    return layout;
  }

  // Condiciones válidas (sin las de operaciones desconocidas).
  function normalizeConditions(raw) {
    const ops = new Set(Object.values(HL_OPS).flat());
    return (Array.isArray(raw) ? raw : [])
      .filter((c) => c && typeof c.param === "string" && ops.has(c.op))
      .map((c) => ({ param: c.param, op: c.op, value: c.value === undefined || c.value === null ? "" : c.value }));
  }

  // Requisitos { match, groups }. El formato anterior ({ match, conditions }) pasa a un único grupo.
  function normalizeRequirements(raw) {
    const r = raw && typeof raw === "object" ? raw : {};
    if (Array.isArray(r.groups)) {
      const groups = r.groups
        .filter((g) => g && typeof g === "object")
        .map((g) => ({ match: g.match === "any" ? "any" : "all", conditions: normalizeConditions(g.conditions) }));
      return { match: r.match === "any" ? "any" : "all", groups };
    }
    const conditions = normalizeConditions(r.conditions);
    return { match: "all", groups: conditions.length ? [{ match: r.match === "any" ? "any" : "all", conditions }] : [] };
  }

  // Resaltado guardado de una lista; las listas anteriores a esta función empiezan con el resaltado por defecto.
  function normalizeHighlight(raw) {
    if (!raw || typeof raw !== "object") return clone(DEFAULT_HIGHLIGHT);
    return { ...normalizeRequirements(raw), color: isColor(raw.color) ? raw.color : "auto", blink: raw.blink === true };
  }

  // Listas de origen de una dependiente.
  function normalizeLinks(raw) {
    const links = [];
    const seen = new Set();
    for (const k of Array.isArray(raw) ? raw : []) {
      if (!k || typeof k.listId !== "string" || seen.has(k.listId)) continue;
      seen.add(k.listId);
      links.push({ listId: k.listId });
    }
    return links;
  }

  // Aspecto de los parámetros de la lista, en el orden en que se ven. Los parámetros que aún no tienen
  // aspecto se añaden al final; los de parámetros quitados se conservan (por si el parámetro vuelve) pero no salen.
  function layoutOf(list) {
    for (const p of list.params) {
      if (!list.layout.some((e) => e.id === p.id)) list.layout.push({ id: p.id, style: defaultStyle(p.id, p.ref === true), color: DEFAULT_COLOR });
    }
    return list.layout.filter((e) => list.params.some((p) => p.id === e.id));
  }

  // Deja los datos en el formato actual sin perder ninguna tarea.
  function normalizeState(data) {
    const base = defaultState();
    if (!data || typeof data !== "object") return base;

    const params = normalizeParams(data.params);

    const lists = (Array.isArray(data.lists) ? data.lists : [])
      .filter((l) => l && typeof l.id === "string")
      .map((l) => ({
        id: l.id,
        kind: l.kind === "linked" ? "linked" : "own",
        links: l.kind === "linked" ? normalizeLinks(l.links) : [],
        filter: normalizeRequirements(l.filter),
        name: typeof l.name === "string" && l.name.trim() ? l.name : null,
        hidden: l.hidden === true,
        showCompleted: l.showCompleted === true,
        sort: Array.isArray(l.sort)
          ? l.sort.filter((s) => s && typeof s.by === "string" && (s.dir === "asc" || s.dir === "desc")).map((s) => ({ by: s.by, dir: s.dir }))
          : clone(DEFAULT_SORT),
        // Las listas guardadas antes de tener parámetros propios conservan los que había.
        params: Array.isArray(l.params) ? normalizeParams(l.params) : clone(params),
        layout: normalizeLayout(l.layout),
        highlight: normalizeHighlight(l.highlight),
      }));
    if (!lists.length) lists.push(base.lists[0]);
    if (!lists.some((l) => l.kind === "own")) lists.unshift(base.lists[0]); // siempre hay una lista independiente
    if (lists.every((l) => l.hidden)) lists[0].hidden = false;
    lists.forEach((list) => {
      const ref = refOf(list.params);
      for (const e of layoutOf(list)) if (e.id === ref && e.style === "hidden") e.style = "title"; // el referente no se puede ocultar
    });
    const own = lists.filter((l) => l.kind === "own"); // solo estas guardan tareas
    lists.forEach((list) => (list.links = list.links.filter((k) => own.some((o) => o.id === k.listId))));
    lists.filter((l) => l.kind === "linked").forEach((list) => syncLinkedParams(list, lists));

    // Las tareas nunca se descartan: si algún dato falta se rellena con un valor por defecto.
    const tasks = [];
    for (const x of Array.isArray(data.tasks) ? data.tasks : []) {
      if (!x || typeof x !== "object" || typeof x.id !== "string") continue;
      const recurring = x.kind === "recurring" && x.recurrence && typeof x.recurrence === "object";
      const task = {
        id: x.id,
        listId: own.some((l) => l.id === x.listId) ? x.listId : own[0].id,
        kind: recurring ? "recurring" : "once",
        title: typeof x.title === "string" ? x.title : "—", // puede estar vacío si el referente de su lista es otro parámetro
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

  // Historial para deshacer (Ctrl+Z) y rehacer (Ctrl+Mayús+Z): una copia de los datos tras cada cambio.
  const HISTORY_LIMIT = 100;
  const history = { past: [], future: [], current: JSON.stringify(state) };

  function persist(json) {
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      /* Sin almacenamiento disponible */
    }
  }

  function saveState() {
    const json = JSON.stringify(state);
    persist(json);
    if (json === history.current) return;
    history.past.push(history.current);
    if (history.past.length > HISTORY_LIMIT) history.past.shift();
    history.current = json;
    history.future = [];
  }

  // Vuelve a una copia del historial y redibuja todo lo que esté a la vista.
  function restoreSnapshot(json) {
    state = normalizeState(JSON.parse(json));
    history.current = JSON.stringify(state);
    persist(history.current);
    renderGrid();
    if ($("settings-dialog").open) renderSettings();
    if ($("list-dialog").open) {
      if (state.lists.some((l) => l.id === editingListId)) renderListDialog();
      else $("list-dialog").close();
    }
  }

  function undo() {
    if (!history.past.length) return;
    history.future.push(history.current);
    restoreSnapshot(history.past.pop());
  }

  function redo() {
    if (!history.future.length) return;
    history.past.push(history.current);
    restoreSnapshot(history.future.pop());
  }

  /* ------------------------------------------------------------------------
     Consultas sobre el estado
     ------------------------------------------------------------------------ */
  const visibleLists = () => state.lists.filter((l) => !l.hidden);
  const listName = (list) => list.name || t("list.default");
  const listById = (id) => state.lists.find((l) => l.id === id) || state.lists.find((l) => l.kind === "own");
  const ownLists = () => state.lists.filter((l) => l.kind === "own");
  const hasParam = (params, id) => params.some((p) => p.id === id);
  const recurringAvailable = (params) => hasParam(params, "repeat"); // sin regla de repetición no hay tareas recurrentes nuevas

  // Parámetro con todos sus datos: nombre traducido, tipo, en qué tareas aparece y si es obligatorio.
  function paramInfo(p) {
    const def = BUILTIN[p.id];
    return {
      id: p.id,
      builtin: Boolean(def),
      type: def ? def.type : p.type,
      kinds: def ? def.kinds : ["once", "recurring"],
      ref: p.ref === true, // referente de la lista: se escribe en su recuadro y da nombre a las tareas
      locked: p.ref === true, // el referente no se quita, no se oculta ni se hace opcional
      fixedRequired: p.ref === true || Boolean(def && def.alwaysRequired),
      options: (def ? def.type : p.type) === "select" ? resolveOptions(p) : null,
      name: def ? t(`param.${p.id}`) : p.name,
      once: p.once,
      recurring: p.recurring,
      required: p.required,
    };
  }

  const allParams = (params) => params.map(paramInfo);
  const paramsFor = (params, kind) => allParams(params).filter((p) => p[kind]); // los que lleva ese tipo de tarea
  const paramById = (params, id) => allParams(params).find((p) => p.id === id);
  // id del parámetro referente (función, no const: se usa al cargar los datos, antes de llegar a esta línea)
  function refOf(params) {
    return (params.find((p) => p.ref) || params[0]).id;
  }

  // Nombre de una tarea: lo que tiene en el parámetro referente de su lista (o, si falta, su título).
  function nameOf(task, params) {
    const ref = refOf(params);
    if (ref !== "title") {
      const info = paramInfo(params.find((p) => p.id === ref));
      const raw = task.values[ref];
      const text = raw === undefined || raw === null ? "" : info.type === "textarea" ? richPlain(raw) : String(raw).trim();
      if (text) return text;
    }
    return task.title || "—";
  }
  // Opciones de un parámetro de lista desplegable: { id, label, color }. En la energía, mientras no se
  // le cambie el nombre, se usa el texto traducido.
  function resolveOptions(p) {
    const stored = p.options || (p.id === "energy" ? DEFAULT_ENERGY : []);
    return stored.map((o) => ({ id: o.id, label: o.label ?? (p.id === "energy" ? t(`energy.${o.id}`) : o.id), color: o.color }));
  }
  const optionOf = (info, value) => (info.options || []).find((o) => o.id === value) || null;
  const optionLabel = (info, value) => (optionOf(info, value) || { label: "" }).label;

  // Una lista desplegable se ordena por la posición de sus opciones: la primera es la "mayor".
  function selectRank(info, value) {
    const options = (info && info.options) || [];
    const i = options.findIndex((o) => o.id === value);
    return i === -1 ? null : options.length - i;
  }

  /* ------------------------------------------------------------------------
     Orden de las tareas
     ------------------------------------------------------------------------ */
  const dueOf = (task) => (task.kind === "recurring" ? task.values.date : task.values.due) || null;
  const dateKey = (v) => (v && v.date ? `${v.date}T${v.time || "23:59"}` : null);
  const kindOfType = (type) => ({ date: "date", number: "number", select: "level", checkbox: "level" })[type] || "text";

  // Criterios por los que se puede ordenar una lista (solo los de parámetros que existen).
  function sortCriteria(params = state.params) {
    const criteria = [];
    if (hasParam(params, "due") || hasParam(params, "date")) criteria.push({ id: "due", label: t("param.due"), kind: "date" });
    if (hasParam(params, "planned")) criteria.push({ id: "planned", label: t("param.planned"), kind: "date" });
    if (hasParam(params, "energy")) criteria.push({ id: "energy", label: t("param.energy"), kind: "level" });
    const ref = allParams(params).find((p) => p.ref); // "title" es el nombre de la tarea, es decir, su referente
    criteria.push({ id: "title", label: ref ? ref.name : t("param.title"), kind: "text" }, { id: "created", label: t("sort.created"), kind: "created" });
    if (hasParam(params, "source")) {
      criteria.push({ id: "sourceOrder", label: t("sort.source.order"), kind: "order" }, { id: "source", label: t("sort.source.name"), kind: "text" });
    }
    for (const p of allParams(params)) if (!p.builtin && !p.ref) criteria.push({ id: p.id, label: p.name, kind: kindOfType(p.type) });
    return criteria;
  }

  function sortValue(task, by, params, nameFn) {
    switch (by) {
      case "due":
        return dateKey(dueOf(task));
      case "planned":
        return dateKey(task.values.planned);
      case "energy":
        return selectRank(params.get("energy"), task.values.energy);
      case "title":
        return nameFn(task);
      case "source":
        return task.values.source;
      case "sourceOrder": {
        // la lista de procedencia, según su posición entre las listas (la que se cambia arrastrándolas)
        const i = state.lists.findIndex((l) => l.id === task.sourceId);
        return i === -1 ? null : i;
      }
      case "created":
        return task.createdAt;
      default: {
        const info = params.get(by);
        const v = task.values[by];
        if (!info || v === undefined || v === null || v === "") return null;
        if (info.type === "number") return Number(v);
        if (info.type === "date") return dateKey(v);
        if (info.type === "select") return selectRank(info, v);
        if (info.type === "checkbox") return v ? 1 : 0;
        if (info.type === "textarea") return richPlain(v);
        return String(v);
      }
    }
  }

  // Ordena por el primer criterio y, si empatan, por el siguiente. Lo que no tiene valor va siempre al final.
  function sortTasks(tasks, sort, source = state.params) {
    const kinds = new Map(sortCriteria(source).map((c) => [c.id, c.kind]));
    const params = new Map(allParams(source).map((p) => [p.id, p]));
    const rules = sort.filter((r) => kinds.has(r.by));
    const locale = I18n.current().locale;
    const nameFn = (task) => nameOf(task, source);

    return [...tasks].sort((a, b) => {
      for (const { by, dir } of rules) {
        const va = sortValue(a, by, params, nameFn);
        const vb = sortValue(b, by, params, nameFn);
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
     Resaltado: cada lista dice qué tareas se resaltan con condiciones sobre sus parámetros
     ------------------------------------------------------------------------ */
  // Parámetros que se pueden usar en una condición (el vencimiento y la fecha de las recurrentes cuentan como uno).
  function highlightParams(params) {
    const out = [];
    for (const p of allParams(params)) {
      if (p.id === "repeat") continue;
      if (p.id === "date") {
        if (!hasParam(params, "due")) out.push({ ...p, id: "due", name: t("param.due") });
        continue;
      }
      // La lista de origen se elige entre las listas (no se escribe): se guarda su id, para que cambiarle el nombre no rompa nada.
      if (p.id === "source") {
        const options = state.lists.filter((l) => l.kind !== "linked").map((l) => ({ id: l.id, label: listName(l) }));
        out.push({ ...p, type: "select", options });
        continue;
      }
      out.push(p);
    }
    return out;
  }

  const rawValue = (task, id) => (id === "title" ? task.title : id === "due" ? dueOf(task) : task.values[id]);

  function defaultConditionValue(op, info) {
    if (op === "inDays" || op === "withinDays") return 1;
    if (HL_NEEDS[op] === "select") return ((info && info.options) || [])[0]?.id ?? "";
    if (HL_NEEDS[op] === "number") return 0;
    return "";
  }

  function conditionMet(task, cond, info) {
    const raw = cond.param === "source" ? task.sourceId : rawValue(task, cond.param); // el origen se compara por id de lista
    const type = info.type;
    const empty =
      type === "date" ? !(raw && raw.date)
        : type === "checkbox" ? !raw
          : type === "textarea" ? richPlain(raw) === ""
            : raw === undefined || raw === null || String(raw).trim() === "";
    switch (cond.op) {
      case "empty": return empty;
      case "notEmpty": return !empty;
      case "checked": return raw === true;
      case "unchecked": return raw !== true;
      case "isNot": if (empty) return true; break;
      default:
    }
    if (empty) return false;
    if (HL_NEEDS[cond.op] && String(cond.value ?? "").trim() === "") return false; // condición a medio escribir

    if (type === "date") {
      const diff = diffDays(raw.date, todayString());
      const n = Number(cond.value);
      if (cond.op === "overdue") return diff < 0;
      if (cond.op === "today") return diff === 0;
      if (cond.op === "inDays") return diff === n;
      if (cond.op === "withinDays") return diff >= 0 && diff <= n;
      return false;
    }
    if (type === "select") return cond.op === "is" ? raw === cond.value : cond.op === "isNot" ? raw !== cond.value : false;
    if (type === "number") {
      const a = Number(raw);
      const n = Number(cond.value);
      return cond.op === "gt" ? a > n : cond.op === "lt" ? a < n : cond.op === "eq" ? a === n : false;
    }
    if (cond.op === "contains") {
      const text = type === "textarea" ? richPlain(raw) : String(raw);
      return text.toLowerCase().includes(String(cond.value).trim().toLowerCase());
    }
    return false;
  }

  // ¿Cumple la tarea unos requisitos { match, groups }? Cada grupo une sus condiciones con Y (todas) u O (alguna) y los
  // grupos, entre sí, también. Las condiciones de parámetros quitados y los grupos vacíos no cuentan.
  // Devuelve null si no hay nada que comprobar (sin requisitos).
  function requirementsMet(task, req, infos) {
    const results = [];
    for (const group of req.groups) {
      const active = group.conditions.filter((c) => infos.has(c.param));
      if (!active.length) continue;
      const test = (c) => conditionMet(task, c, infos.get(c.param));
      results.push(group.match === "any" ? active.some(test) : active.every(test));
    }
    if (!results.length) return null;
    return req.match === "any" ? results.some(Boolean) : results.every(Boolean);
  }

  // El resaltado de la lista si la tarea cumple sus condiciones, o null.
  function highlightOf(task, list) {
    const hl = list.highlight;
    if (task.done || !hl) return null;
    const infos = new Map(highlightParams(list.params).map((p) => [p.id, p]));
    return requirementsMet(task, hl, infos) ? hl : null;
  }

  /* ------------------------------------------------------------------------
     Listas dependientes
     No guardan tareas: muestran las de las listas independientes que enlazan. Cada tarea se convierte en una
     "tarea virtual" con los parámetros de la dependiente (según lo que el usuario eligió en cada origen) y
     sobre ella se aplican los requisitos, el orden, el aspecto y el resaltado. Completarla o editarla actúa
     sobre la tarea real (task.real).
     ------------------------------------------------------------------------ */
  // Dos parámetros de listas distintas son "el mismo" si son el mismo predefinido, la misma lista desplegable
  // (mismo id: pasa al añadirlo con el + de otra lista) o tienen el mismo tipo y nombre.
  const paramKey = (info) => (info.builtin || info.type === "select" ? info.id : `${info.type}:${info.name.trim().toLowerCase()}`);

  // Los parámetros de una dependiente no se crean: son todos los distintos que tienen sus listas de origen
  // (el vencimiento y la fecha de las recurrentes cuentan como uno). Se recalculan al cambiar los orígenes.
  function syncLinkedParams(list, lists = state.lists) {
    const out = [{ ...DEFAULT_PARAMS[0] }, { id: "source", once: true, recurring: true, required: false }]; // título y lista de origen
    const byKey = new Map([["title", out[0]], ["source", out[1]]]);
    for (const link of list.links) {
      const source = lists.find((l) => l.id === link.listId && l.kind === "own");
      if (!source) continue;
      for (const p of source.params) {
        if (p.id === "repeat" || p.id === "title" || p.id === "source") continue;
        const def = BUILTIN[p.id];
        const id = p.id === "date" ? "due" : p.id;
        const type = def ? def.type : p.type;
        const key = def || type === "select" ? id : `${type}:${p.name.trim().toLowerCase()}`;
        const options = type === "select" ? p.options || (p.id === "energy" ? DEFAULT_ENERGY : []) : null;
        let entry = byKey.get(key);
        if (!entry) {
          entry = def ? { id, once: true, recurring: true, required: false } : { id, type, name: p.name, once: true, recurring: true, required: false };
          if (options) entry.options = [];
          byKey.set(key, entry);
          out.push(entry);
        }
        if (options) for (const o of options) if (!entry.options.some((x) => x.id === o.id)) entry.options.push(clone(o));
      }
    }
    list.params = out;
  }

  function convertValue(raw, from, to) {
    if (raw === undefined || raw === null) return undefined;
    if (to.type === "date") return raw && raw.date ? { date: raw.date, time: raw.time || "" } : undefined;
    if (to.type === "select") {
      const options = to.options || [];
      const fromOption = (from.options || []).find((o) => o.id === raw);
      const match = options.find((o) => o.id === raw) || (fromOption && options.find((o) => o.label.toLowerCase() === fromOption.label.toLowerCase()));
      return match ? match.id : undefined;
    }
    if (to.type === "text") return from.type === "textarea" ? richPlain(raw) : String(raw);
    return raw;
  }

  function tasksOfLinked(list) {
    const infos = allParams(list.params);
    const conditionInfos = new Map(highlightParams(list.params).map((p) => [p.id, p]));
    const out = [];
    for (const link of list.links) {
      const source = state.lists.find((l) => l.id === link.listId && l.kind === "own");
      if (!source) continue;
      const sourceInfos = highlightParams(source.params);
      const maps = infos.map((info) => [info, sourceInfos.find((p) => paramKey(p) === paramKey(info)) || null]);
      for (const real of state.tasks) {
        if (real.listId !== source.id) continue;
        const values = { source: listName(source) }; // cada tarea lleva el nombre de la lista de la que viene
        let title = nameOf(real, source.params);
        for (const [info, from] of maps) {
          if (!from) continue;
          const v = convertValue(rawValue(real, from.id), from, info);
          if (info.id === "title") {
            if (v) title = v;
          } else if (hasValue(v)) {
            values[info.id] = v;
          }
        }
        const virtual = { id: real.id, real, listId: list.id, sourceId: source.id, kind: "once", title, values, createdAt: real.createdAt, done: real.done === true, completedAt: real.completedAt };
        if (requirementsMet(virtual, list.filter, conditionInfos) !== false) out.push(virtual);
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------------
     Tareas en pantalla
     Cada lista decide cómo se ve cada parámetro y en qué orden (list.layout: { id, style, color }):
     título, descripción, dato (texto pequeño), etiqueta, etiqueta de color u oculto.
     Los datos y las etiquetas seguidos se juntan en una misma fila.
     ------------------------------------------------------------------------ */
  function formatValue(info, value) {
    if (info.type === "date") return value && value.date ? dateLabel(value, todayString()).text : "";
    if (info.type === "select") return optionLabel(info, value);
    return String(value);
  }

  const hasValue = (v) => !(v === undefined || v === null || v === "" || v === false);

  // Lo que se enseña de un parámetro en una tarea, o null si no hay nada que enseñar:
  // { text, diff (días hasta la fecha), bars (nivel de energía), repeat }
  function shownValue(task, info, style) {
    if (info.id === "title") return task.title ? { text: task.title } : info.ref ? { text: "—" } : null;
    if (!info[task.kind]) return null; // el parámetro no está activo para este tipo de tarea
    if (info.id === "repeat") {
      return task.kind === "recurring" && task.recurrence ? { text: repeatSummary(task.recurrence), repeat: true } : null;
    }
    const value = task.values[info.id];
    if (!hasValue(value)) return null;
    const labeled = style === "meta" && !info.builtin; // los parámetros propios, como dato, llevan su nombre delante

    if (info.type === "date") {
      if (!value.date) return null;
      if (info.id === "planned") {
        const when = shortDate(value.date, todayString()) + (value.time ? ` ${value.time}` : "");
        return { text: style === "meta" ? t("meta.planned", { date: when }) : when };
      }
      const label = dateLabel(value, todayString());
      return { text: labeled ? `${info.name}: ${label.text}` : label.text, diff: info.id === "due" || info.id === "date" ? label.diff : null };
    }
    if (info.type === "select") {
      const option = optionOf(info, value);
      if (!option) return null; // la opción ya no existe: se conserva el dato, pero no se enseña
      if (info.id === "energy") {
        const bars = Math.max(1, Math.round((selectRank(info, value) / info.options.length) * 3)); // 1 a 3 barras
        return style === "meta" ? { text: `${info.name}: ${option.label}`, bars, color: option.color } : { text: option.label, color: option.color };
      }
      return { text: labeled ? `${info.name}: ${option.label}` : option.label, color: option.color };
    }
    if (value === true) return { text: info.name };
    if (info.type === "textarea") {
      const plain = richPlain(value);
      if (!plain) return null;
      return { text: labeled ? `${info.name}: ${plain}` : plain, html: richHtml(value) };
    }
    const text = formatValue(info, value);
    return { text: labeled ? `${info.name}: ${text}` : text };
  }

  function entryNode(task, info, entry) {
    const shown = shownValue(task, info, entry.style);
    if (!shown) return null;
    if (entry.style === "title") return h("span", { class: "task-name", text: shown.text });
    if (entry.style === "description") return h("div", { class: "task-desc", html: shown.html, text: shown.html ? null : shown.text });
    if (entry.style === "badge") {
      const color = shown.color || entry.color; // en las listas desplegables manda el color de la opción
      return h("span", { class: "badge", style: `--tag:${color};--tag-ink:${inkFor(color)}`, text: shown.text });
    }
    const emphasis = task.done ? "" : shown.diff < 0 ? " meta-overdue" : "";
    if (entry.style === "tag") {
      return h("span", { class: `tag${shown.color ? " has-color" : ""}${emphasis}`, style: shown.color ? `--tag:${shown.color}` : null, text: shown.text });
    }
    if (shown.bars) {
      const props = { class: "energy", role: "img", "aria-label": shown.text, style: shown.color ? `color:${shown.color}` : null, dataset: { level: shown.bars } };
      return h("span", props, h("i"), h("i"), h("i"));
    }
    return h(
      "span",
      { class: `meta${emphasis}` },
      shown.repeat ? icon("repeat", 13) : null,
      shown.color ? h("span", { class: "dot", style: `--dot:${shown.color}` }) : null,
      shown.text
    );
  }

  function taskElement(task, list, entering) {
    const infos = new Map(allParams(list.params).map((p) => [p.id, p]));
    const hl = highlightOf(task, list); // las tareas que cumplen el resaltado de la lista
    const item = h("li", {
      class: `task${entering ? " entering" : ""}${hl ? ` is-highlighted${hl.blink ? " hl-blink" : ""}` : ""}${task.done ? " is-completed" : ""}`,
      style: hl ? `--hl:${hl.color === "auto" ? "var(--accent)" : hl.color}` : null,
      dataset: { id: task.id },
    });

    const checkbox = h("input", {
      type: "checkbox",
      class: "check",
      checked: task.done === true,
      "aria-label": t("task.complete", { name: nameOf(task, list.params) }),
      onchange: (event) => {
        const real = task.real || task; // en una lista dependiente, la tarea de verdad es la de su lista de origen
        if (task.done && !event.target.checked) restoreTask(real);
        else if (!task.done && event.target.checked) completeTask(real, item, list);
      },
    });

    // Los parámetros salen en el orden y con el aspecto de la lista.
    const blocks = [];
    let row = null;
    for (const entry of layoutOf(list)) {
      if (entry.style === "hidden") continue;
      const node = entryNode(task, infos.get(entry.id), entry);
      if (!node) continue;
      if (entry.style === "title" || entry.style === "description") {
        blocks.push(node);
        row = null;
      } else {
        if (!row) {
          row = h("div", { class: "task-meta" });
          blocks.push(row);
        }
        row.append(node);
      }
    }

    const body = h("div", { class: "task-body", onclick: () => openTaskDialogForEdit(task.real || task) }, blocks);
    item.append(h("div", { class: "task-row" }, h("div", { class: "task-content" }, checkbox, body)));
    return item;
  }

  // Las tareas únicas completadas se marcan (no se borran) y se muestran u ocultan según la lista.
  function completeTask(task, item, viewList) {
    item.classList.add("done");
    const list = viewList || state.lists.find((l) => l.id === task.listId); // la lista en la que se está viendo

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
    const missing = paramsFor(list.params, "once").filter((p) => !p.ref && p.required);
    if (missing.length) {
      openTaskDialog(list, true);
      return;
    }
    // Lo escrito va al parámetro referente de la lista (por defecto, el título).
    const ref = refOf(list.params);
    const task = { id: uid(), listId: list.id, kind: "once", title: ref === "title" ? title : "", values: ref === "title" ? {} : { [ref]: title }, createdAt: Date.now() };
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

  // full: la lista a pantalla completa (se abre pulsando su título).
  function buildCard(list, enteringId, full = false) {
    const linked = list.kind === "linked";
    const items = linked ? tasksOfLinked(list) : state.tasks.filter((x) => x.listId === list.id);
    const pending = sortTasks(items.filter((x) => !x.done), list.sort, list.params);
    const completed = list.showCompleted ? items.filter((x) => x.done).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)) : [];

    const count = pending.length ? h("span", { class: "card-count", text: String(pending.length) }) : null;
    const options = h(
      "button",
      { class: "icon-btn", type: "button", "aria-haspopup": "dialog", "aria-label": `${t("list.options")}: ${listName(list)}`, onclick: () => openListDialog(list.id) },
      icon("dots", 22)
    );
    const head = full
      ? h(
        "header",
        { class: "card-head" },
        h("button", { class: "icon-btn", type: "button", "aria-label": t("list.back"), onclick: closeFull }, icon("chevronLeft", 22)),
        h("h2", { class: "card-title", text: listName(list) }),
        count,
        options
      )
      : h(
        "header",
        { class: "card-head" },
        h("button", {
          class: "icon-btn small grip",
          type: "button",
          "aria-label": `${t("list.move")}: ${listName(list)}`,
          onpointerdown: (event) => startDrag(event, list.id),
          onkeydown: (event) => {
            const by = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[event.key];
            if (!by) return;
            event.preventDefault();
            moveList(list.id, by);
          },
        }, icon("grip", 18)),
        h(
          "h2",
          { class: "card-title" },
          h("button", { class: "card-title-btn", type: "button", text: listName(list), "aria-label": `${t("list.open")}: ${listName(list)}`, onclick: () => openFull(list.id) })
        ),
        count,
        options
      );

    return h(
      "section",
      { class: `list-card${full ? " list-card-full" : ""}`, dataset: { list: list.id }, "aria-label": listName(list) },
      head,
      linked ? null : addRow(list),
      h("ul", { class: "list" }, pending.map((x) => taskElement(x, list, x.id === enteringId))),
      h("p", { class: "card-empty", text: t(linked && !list.links.length ? "link.empty" : "task.empty"), hidden: pending.length > 0 }),
      completed.length
        ? h(
          "div",
          { class: "completed" },
          h("h3", { class: "completed-title", text: `${t("task.completed.title")} · ${completed.length}` }),
          h("ul", { class: "list" }, completed.map((x) => taskElement(x, list, false)))
        )
        : null
    );
  }

  // Pone las listas visibles en el orden de "ids" (las ocultas conservan su sitio).
  function applyOrder(ids) {
    const byId = new Map(state.lists.map((l) => [l.id, l]));
    let k = 0;
    state.lists = state.lists.map((l) => (l.hidden ? l : byId.get(ids[k++])));
    saveState();
  }

  // Con el teclado: flechas sobre el asa de la lista.
  function moveList(id, by) {
    const ids = visibleLists().map((l) => l.id);
    const i = ids.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    applyOrder(ids);
    renderGrid();
    const grip = $("lists-grid").querySelector(`[data-list="${id}"] .grip`);
    if (grip) grip.focus();
  }

  // Arrastrar una lista por su asa: la tarjeta sigue al puntero y un hueco marca dónde caerá. Las columnas se
  // vuelven a repartir en cada cambio, así que quedan siempre igualadas.
  function startDrag(event, listId) {
    if (event.button !== undefined && event.button !== 0) return;
    const card = event.currentTarget.closest(".list-card");
    if (!card || expandedId) return;
    event.preventDefault();

    const all = [...$("lists-grid").querySelectorAll(":scope > .lists-col > *")];
    const addCard = all.find((c) => !c.dataset.list); // el recuadro de "Nueva lista" siempre va al final
    const seq = all.filter((c) => c.dataset.list);
    const rect = card.getBoundingClientRect();
    const grabX = event.clientX - rect.left;
    const grabY = event.clientY - rect.top;
    const placeholder = h("div", { class: "list-card list-card-placeholder", style: `height:${rect.height}px` });
    seq[seq.indexOf(card)] = placeholder;

    Object.assign(card.style, { position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, zIndex: "30", pointerEvents: "none" });
    card.classList.add("is-dragging");
    document.body.append(card);
    document.documentElement.classList.add("is-dragging");
    Flucti.dragging = true;
    placeCards([...seq, addCard]);

    let x = event.clientX;
    let y = event.clientY;
    let lastSwap = 0;
    let raf = 0;

    const update = () => {
      card.style.left = `${x - grabX}px`;
      card.style.top = `${y - grabY}px`;
      if (performance.now() - lastSwap < 160) return; // evita saltos de un lado a otro al recolocar
      const target = [...seq, addCard].find((c) => {
        if (c === placeholder) return false;
        const r = c.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      });
      if (!target) return;
      const from = seq.indexOf(placeholder);
      const to = target === addCard ? seq.length - 1 : seq.indexOf(target);
      if (to === from) return;
      seq.splice(from, 1);
      seq.splice(to, 0, placeholder);
      lastSwap = performance.now();
      placeCards([...seq, addCard]);
    };

    const tick = () => {
      const sheet = $("tasks"); // la hoja de tareas es la que se desplaza
      if (y < 90 && sheet.scrollTop > 0) sheet.scrollTop -= 14;
      else if (y > window.innerHeight - 90) sheet.scrollTop += 14;
      update();
      raf = requestAnimationFrame(tick);
    };

    const move = (e) => {
      x = e.clientX;
      y = e.clientY;
    };
    const end = (e) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      cancelAnimationFrame(raf);
      card.remove();
      document.documentElement.classList.remove("is-dragging");
      Flucti.dragging = false;
      if (e.type === "pointerup") applyOrder(seq.map((c) => (c === placeholder ? listId : c.dataset.list)));
      renderGrid();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    raf = requestAnimationFrame(tick);
  }

  // Lista a pantalla completa: sustituye a la rejilla hasta que se cierra (flecha o Esc).
  const fullView = $("list-full");
  let expandedId = null;

  function openFull(id) {
    expandedId = id;
    fullView.hidden = false;
    fullView.scrollTop = 0;
    Flucti.openDialogs.add(fullView); // bloquea el desplazamiento de la página, como las ventanas
    document.documentElement.classList.add("modal-open");
    renderGrid();
  }

  function closeFull() {
    if (!expandedId) return;
    expandedId = null;
    fullView.hidden = true;
    $("list-full-body").replaceChildren();
    Flucti.openDialogs.delete(fullView);
    if (!Flucti.openDialogs.size) document.documentElement.classList.remove("modal-open");
    renderGrid();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && expandedId && [...Flucti.openDialogs].every((d) => d === fullView)) closeFull();
  });

  function createList(name, kind = "own") {
    // Una independiente empieza con los parámetros por defecto; una dependiente, con los de sus listas de origen.
    const list = makeList({ name, kind, params: kind === "linked" ? DEFAULT_PARAMS.slice(0, 1) : state.params });
    if (kind === "linked") syncLinkedParams(list);
    state.lists.push(list);
    saveState();
    renderGrid();
    openListDialog(list.id); // se abren sus opciones: en una dependiente, lo primero es elegir de qué listas salen las tareas
  }

  // Última "tarjeta": el botón "Nuevo". Abre un menú (como el de ajustes) para elegir el tipo de lista y luego
  // se escribe su nombre en la propia tarjeta.
  let newKind = "own";
  const newDialog = $("new-dialog");

  function renderNewMenu() {
    $("new-body").replaceChildren(
      ...["own", "linked"].map((kind) =>
        h(
          "button",
          {
            class: "menu-row",
            type: "button",
            onclick: () => {
              newDialog.close();
              newKind = kind;
              addingList = true;
              focusedKey = NEW_KEY;
              renderGrid();
            },
          },
          h("span", { class: "menu-text" }, h("span", { text: t(`list.kind.${kind}`) }), h("small", { text: t(`list.kind.${kind}.hint`) })),
          icon("chevron", 18)
        )
      )
    );
  }

  function newListCard() {
    if (!addingList) {
      return h(
        "button",
        {
          class: "list-card list-card-add",
          type: "button",
          "aria-label": t("list.add"),
          "aria-haspopup": "dialog",
          onclick: () => {
            renderNewMenu();
            Flucti.openDialog(newDialog);
          },
        },
        icon("plus", 20),
        h("span", { text: t("list.new") })
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
      if (create && name) createList(name, newKind);
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

  // Mismo punto de corte que el CSS: a partir de ahí hay dos columnas.
  const wide = window.matchMedia("(min-width: 56rem)");

  // Reparte las tarjetas en dos columnas de altura parecida sin cambiar su orden: las primeras van a la
  // izquierda y el resto a la derecha, en el punto que deja las dos columnas más igualadas (si la primera
  // lista es tan larga como tres vacías, ella sola va a la izquierda y las demás a la derecha).
  // El recuadro de "Nueva lista" cuenta como una tarjeta más, la última. En pantallas pequeñas solo hay una
  // columna y el orden es el mismo.
  function placeCards(cards) {
    const [left, right] = $("lists-grid").children;
    left.replaceChildren(...cards); // primero todas juntas, a la misma anchura que tendrán después
    right.replaceChildren();
    if (!wide.matches || cards.length < 2) return;

    const heights = cards.map((card) => card.getBoundingClientRect().height);
    const gap = parseFloat(getComputedStyle(left).rowGap) || 0;
    const sum = (from, to) => heights.slice(from, to).reduce((total, height) => total + height, 0) + gap * Math.max(0, to - from - 1);

    let split = 1;
    let best = Infinity;
    for (let k = 1; k < cards.length; k++) {
      const difference = Math.abs(sum(0, k) - sum(k, cards.length));
      if (difference < best) {
        best = difference;
        split = k;
      }
    }
    right.append(...cards.slice(split));
  }

  // Vuelve a repartir las tarjetas que ya están en pantalla (al cambiar el ancho o cargarse la tipografía).
  function rebalance() {
    if (focusedKey || expandedId || Flucti.dragging) return; // no se mueve nada mientras se escribe, se arrastra o hay una lista abierta
    placeCards([...$("lists-grid").querySelectorAll(":scope > .lists-col > *")]);
  }

  function renderGrid(enteringId) {
    rendering = true;
    state.lists.forEach((l) => l.kind === "linked" && syncLinkedParams(l)); // por si cambiaron los parámetros de sus orígenes
    const restore = focusedKey;
    inputs.clear();
    newListInput = null;
    const open = expandedId && visibleLists().find((l) => l.id === expandedId);
    if (expandedId && !open) {
      // la lista abierta se ocultó o se eliminó: se vuelve a la rejilla
      expandedId = null;
      fullView.hidden = true;
      Flucti.openDialogs.delete(fullView);
      if (!Flucti.openDialogs.size) document.documentElement.classList.remove("modal-open");
    }
    if (open) {
      $("list-full-body").replaceChildren(buildCard(open, enteringId, true));
    } else {
      const cards = [...visibleLists().map((list) => buildCard(list, enteringId)), newListCard()];
      $("lists-grid").replaceChildren(h("div", { class: "lists-col" }), h("div", { class: "lists-col" }));
      placeCards(cards);
    }
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
  const draftParams = () => listById(draft.listId).params; // los parámetros de la lista de la tarea

  const isEmptyValue = (info, v) => {
    if (info.type === "date") return !(v && v.date);
    if (info.type === "checkbox") return !v;
    if (info.type === "textarea") return richPlain(v) === "";
    return v === undefined || v === null || String(v).trim() === "";
  };

  function isMissing(info) {
    if (info.id === "repeat") return !recurrenceValid(draft.recurrence);
    if (!info.required) return false;
    return isEmptyValue(info, draft.values[info.id]);
  }

  const missingParams = () => paramsFor(draftParams(), draft.kind).filter((p) => !p.ref && isMissing(p));
  // El referente es el parámetro que da nombre a la tarea: siempre es obligatorio (si queda vacío, la tarea se descarta).
  const draftRef = () => paramById(draftParams(), refOf(draftParams()));
  const draftRefText = () => {
    const info = draftRef();
    const v = draft.values[info.id];
    return cleanTitle(info.type === "textarea" ? richPlain(v || "") : String(v ?? ""));
  };
  const titleEmpty = () => !draftRefText();

  // Sin título la tarea se descarta: se avisa en rojo mientras esté vacío. Si faltan parámetros obligatorios, se dice cuáles.
  const titleGroup = () => $("task-fields").querySelector(`[data-param="${refOf(draftParams())}"]`);

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
    const missing = draft.showErrors && !info.ref && isMissing(info);
    const group = h("div", { class: `field-group${missing ? " invalid" : ""}`, dataset: { param: info.id } });
    const inputId = `task-field-${info.id}`;
    const label = (tag = "label") => h(tag, { class: "field-label", for: tag === "label" ? inputId : null, text: info.name });
    const value = draft.values[info.id];
    const store = (v) => (draft.values[info.id] = v);

    if (info.type === "textarea") {
      group.append(
        h("div", { class: "field-label", text: info.name }),
        richEditor({
          value: value || "",
          label: info.name,
          heightKey: info.id,
          onChange: (v) => {
            store(v);
            if (info.ref) refreshTaskError();
          },
        })
      );
    } else if (info.type === "text" || info.type === "number") {
      const props = {
        class: "field",
        id: inputId,
        type: info.type === "number" ? "number" : "text",
        value: value ?? "",
        oninput: (e) => {
          store(e.target.value);
          if (info.ref) refreshTaskError();
        },
      };
      if (info.type === "number") Object.assign(props, { inputmode: "decimal", step: "any" });
      else props.maxlength = info.ref ? 120 : 200;
      if (info.ref) {
        props.onkeydown = (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            attemptCloseTask(true);
          }
        };
      }
      group.append(label(), h("input", props));
    } else if (info.type === "select") {
      const options = [{ value: "", label: t("field.none") }, ...(info.options || []).map((o) => ({ value: o.id, label: o.label, color: o.color }))];
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
    $("task-fields").replaceChildren(...paramsFor(draftParams(), draft.kind).map(buildField));
    refreshTaskError();
  }

  // Eliminar una tarea: el botón pide confirmación con una segunda pulsación (como eliminar una lista).
  let deleteTaskArmed = false;
  let deleteTaskTimer = 0;

  function paintDeleteTask() {
    const button = $("task-delete-btn");
    button.hidden = !(draft && draft.editingTaskId);
    button.textContent = t(deleteTaskArmed ? "task.delete.confirm" : "task.delete");
  }

  function renderTaskDialog() {
    if (!recurringAvailable(draftParams()) && !draft.editingTaskId) draft.kind = "once"; // al editar una recurrente no se convierte
    $("task-kind").replaceChildren(
      ...(recurringAvailable(draftParams())
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
    paintDeleteTask();
  }

  function openTaskDialog(list, showErrors = false) {
    deleteTaskArmed = false;
    const title = cleanTitle(inputs.get(list.id) ? inputs.get(list.id).value : "");
    $("task-dialog-title").textContent = t("task.dialog.new");
    draft = {
      listId: list.id,
      kind: "once",
      values: { [refOf(list.params)]: title },
      recurrence: { mode: "interval", every: 1, unit: "week", days: [] },
      showErrors, // true: se abre ya señalando los parámetros obligatorios que faltan
    };
    $("task-dialog-list").textContent = listName(list);
    renderTaskDialog();
    Flucti.openDialog($("task-dialog"));
  }

  function openTaskDialogForEdit(task) {
    deleteTaskArmed = false;
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
    for (const info of paramsFor(draftParams(), kind)) {
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
      title: cleanTitle(draft.values.title || ""),
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
     Ajustes: un menú con tres apartados (parámetros por defecto, listas y acerca de)
     Los controles de parámetros sirven para los de por defecto (los que reciben las listas nuevas) y para
     los de cada lista (en sus opciones). Cada ámbito ("scope") edita solo los suyos.
     ------------------------------------------------------------------------ */
  let settingsView = null; // null (menú), "params", "lists" o "about"
  const blankOption = (n = 0) => ({ id: uid(), label: "", color: PALETTE[n % PALETTE.length] });
  const newParamForm = () => ({ name: "", type: "text", options: [blankOption()], once: true, recurring: true, required: false, error: false, editId: null, builtin: false });
  const settingsScope = { list: null, form: null, rerender: () => renderSettings() };
  const listScope = { list: null, form: null, rerender: () => renderListDialog() };
  const scopeParams = (scope) => (scope.list ? scope.list.params : state.params);
  const setScopeParams = (scope, params) => {
    if (scope.list) scope.list.params = params;
    else state.params = params;
  };

  function afterParamsChange(scope) {
    saveState();
    renderGrid();
    if (scope.list && $("task-dialog").open && draft && draft.listId === scope.list.id) renderTaskFields();
  }

  function paramCheck(scope, p, info, field, label) {
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
        afterParamsChange(scope);
      },
    });
  }

  function paramRow(scope, p) {
    const info = paramInfo(p);
    // Se pueden editar pulsando su nombre: los propios (nombre y opciones) y la energía (sus opciones).
    const name = info.builtin && info.type !== "select"
      ? h("span", { text: info.name })
      : h("button", {
        class: "param-edit",
        type: "button",
        text: info.name,
        "aria-label": `${t("param.edit")}: ${info.name}`,
        onclick: () => {
          scope.form = { ...newParamForm(), name: info.name, type: info.type, options: (info.options || []).map((o) => ({ ...o })), editId: p.id, builtin: info.builtin };
          scope.rerender();
        },
      });
    return h(
      "div",
      { class: "param-row" },
      h("div", { class: "param-name" }, name, h("small", { text: info.ref ? `${t(`type.${info.type}`)} · ${t("param.refBadge")}` : t(`type.${info.type}`) })),
      h("div", { class: "param-cell" }, paramCheck(scope, p, info, "once", t("kind.once"))),
      h("div", { class: "param-cell" }, paramCheck(scope, p, info, "recurring", t("kind.recurring"))),
      h("div", { class: "param-cell" }, paramCheck(scope, p, info, "required", t("param.required"))),
      info.locked
        ? h("span")
        : h(
          "button",
          {
            class: "icon-btn small",
            type: "button",
            "aria-label": `${t("param.remove")}: ${info.name}`,
            onclick: () => {
              setScopeParams(scope, scopeParams(scope).filter((x) => x.id !== p.id)); // los datos de las tareas se conservan
              afterParamsChange(scope);
              scope.rerender();
            },
          },
          icon("trash", 16)
        )
    );
  }

  // Vuelve a poner un parámetro predefinido que se quitó, en su sitio.
  function restoreParam(scope, id) {
    const params = scopeParams(scope);
    const def = DEFAULT_PARAMS.find((p) => p.id === id);
    if (!def || hasParam(params, id)) return;
    const order = DEFAULT_PARAMS.map((p) => p.id);
    const later = order.slice(order.indexOf(id) + 1);
    const at = params.findIndex((p) => later.includes(p.id));
    const copy = { ...def };
    delete copy.ref; // el referente de la lista no cambia al restaurar un parámetro
    if (at === -1) params.push(copy);
    else params.splice(at, 0, copy);
    afterParamsChange(scope);
    scope.rerender();
  }

  // Editor de las opciones de una lista desplegable: una fila por opción, con su color, su nombre,
  // un botón para subirla y otro para quitarla. Enter en un nombre abre otra opción debajo.
  function optionsEditor(f) {
    const host = h("div", { class: "options-editor", role: "group", "aria-label": t("param.options"), hidden: f.type !== "select" });
    let open = -1; // opción con la paleta de colores abierta
    let focusAt = -1; // opción que recibe el cursor tras dibujar

    const add = (at) => {
      f.options.splice(at, 0, blankOption(f.options.length));
      open = -1;
      focusAt = at;
      paint();
    };

    function paint() {
      host.replaceChildren(
        ...f.options.map((option, i) =>
          h(
            "div",
            { class: "option-item" },
            h(
              "div",
              { class: "option-row" },
              h("button", {
                type: "button",
                class: "swatch",
                style: `--swatch:${option.color}`,
                "aria-label": `${t("layout.color")}: ${option.label || i + 1}`,
                "aria-expanded": String(open === i),
                onclick: () => {
                  open = open === i ? -1 : i;
                  paint();
                },
              }),
              h("input", {
                class: "field",
                type: "text",
                maxlength: 30,
                value: option.label,
                placeholder: t("option.placeholder"),
                "aria-label": t("option.label"),
                oninput: (event) => (option.label = event.target.value),
                onkeydown: (event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    add(i + 1);
                  }
                },
              }),
              i > 0
                ? h(
                  "button",
                  {
                    class: "icon-btn small",
                    type: "button",
                    "aria-label": t("option.up"),
                    onclick: () => {
                      [f.options[i - 1], f.options[i]] = [f.options[i], f.options[i - 1]];
                      open = -1;
                      paint();
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
                  disabled: f.options.length === 1,
                  "aria-label": t("option.remove"),
                  onclick: () => {
                    f.options.splice(i, 1);
                    open = -1;
                    paint();
                  },
                },
                icon("close", 16)
              )
            ),
            open === i
              ? colorPicker(option.color, (color) => {
                option.color = color;
                open = -1;
                paint();
              })
              : null
          )
        ),
        h("button", { class: "text-btn", type: "button", text: t("option.add"), onclick: () => add(f.options.length) })
      );
      if (focusAt >= 0) {
        const input = host.querySelectorAll(".option-row input")[focusAt];
        focusAt = -1;
        if (input) input.focus();
      }
    }

    paint();
    return host;
  }

  // Formulario para añadir un parámetro propio o, si trae "editId", para cambiar uno: el nombre (salvo en la
  // energía) y, en las listas desplegables, sus opciones.
  function paramFormElement(scope) {
    const f = scope.form;
    const editing = Boolean(f.editId);
    const editor = optionsEditor(f);
    const typeSelect = dropdown({
      value: f.type,
      label: t("param.type"),
      options: TYPES.map((type) => ({ value: type, label: t(`type.${type}`) })),
      onChange: (type) => {
        f.type = type;
        editor.hidden = type !== "select";
      },
    });
    const check = (field, text) =>
      h("label", { class: "check-row" }, h("input", { type: "checkbox", checked: f[field], onchange: (event) => (f[field] = event.target.checked) }), text);

    const submit = () => {
      const name = f.name.trim();
      const params = scopeParams(scope);
      const target = editing ? params.find((x) => x.id === f.editId) : null;
      const isEnergy = Boolean(target && target.id === "energy");
      // Las opciones sin nombre se descartan. En la energía, un nombre sin cambiar sigue siendo el traducido.
      const list =
        f.type === "select"
          ? f.options
            .map((o) => ({ id: o.id, label: o.label.trim(), color: o.color }))
            .filter((o) => o.label)
            .map((o) => (isEnergy && o.label === t(`energy.${o.id}`) ? { id: o.id, color: o.color } : o))
          : [];
      if ((!f.builtin && !name) || (f.type === "select" && !list.length)) {
        f.error = true;
        scope.rerender();
        return;
      }
      if (editing) {
        if (target) {
          if (!f.builtin) target.name = name;
          if (target.type === "select" || isEnergy) target.options = list;
        }
      } else {
        const param = { id: uid(), type: f.type, name, once: f.once, recurring: f.recurring, required: f.required };
        if (f.type === "select") param.options = list;
        params.push(param);
      }
      scope.form = null;
      afterParamsChange(scope);
      scope.rerender();
    };

    return h(
      "div",
      { class: "param-form" },
      f.builtin
        ? null
        : h("input", {
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
      editing ? null : typeSelect,
      editor,
      editing ? null : h("div", { class: "check-group" }, check("once", t("kind.once")), check("recurring", t("kind.recurring")), check("required", t("param.required"))),
      f.error ? h("p", { class: "form-error", role: "alert", text: t("param.error") }) : null,
      h(
        "div",
        { class: "form-actions" },
        h("button", { class: "primary-btn", type: "button", text: editing ? t("task.saveButton") : t("param.create"), onclick: submit }),
        h("button", {
          class: "text-btn",
          type: "button",
          text: t("param.cancel"),
          onclick: () => {
            scope.form = null;
            scope.rerender();
          },
        })
      )
    );
  }

  // Elige el parámetro referente (el que se escribe en el recuadro de la lista y da nombre a las tareas).
  function setRef(scope, id) {
    const params = scopeParams(scope);
    const next = params.find((p) => p.id === id);
    if (!next) return;
    for (const p of params) delete p.ref;
    Object.assign(next, { ref: true, once: true, recurring: true, required: true });
    if (scope.list) {
      // en la lista, el nuevo referente se ve como título (y no puede quedar oculto)
      const entry = layoutOf(scope.list).find((e) => e.id === id);
      if (entry && entry.style !== "description") entry.style = "title";
    }
    afterParamsChange(scope);
    scope.rerender();
  }

  // Tabla de parámetros: la de por defecto (Ajustes) o la de una lista (sus opciones).
  function paramsSection(scope) {
    const params = scopeParams(scope);
    const candidates = allParams(params).filter((p) => p.id !== "source" && (p.type === "text" || p.type === "textarea"));
    const refPicker = h(
      "div",
      { class: "field-group" },
      h("span", { class: "field-label", text: t("ref.label") }),
      dropdown({ value: refOf(params), label: t("ref.label"), options: candidates.map((p) => ({ value: p.id, label: p.name })), onChange: (id) => setRef(scope, id) }),
      h("p", { class: "settings-hint", text: t("ref.hint") })
    );
    const grid = h("div", { class: "param-grid", role: "group", "aria-label": t("settings.params") });
    grid.append(
      h("div", { class: "param-row param-header" }, h("span"), ...["col.once", "col.recurring", "col.required"].map((key) => h("span", { text: t(key) })), h("span"))
    );
    for (const p of params) grid.append(paramRow(scope, p));

    const removed = DEFAULT_PARAMS.filter((d) => !hasParam(params, d.id));

    // Los parámetros propios que ya existen en otras listas (o en los de por defecto) se ofrecen con un "+".
    const suggestions = [];
    const seen = new Set(params.map((p) => p.id));
    for (const source of [...ownLists().map((l) => l.params), state.params]) {
      for (const p of source) {
        if (BUILTIN[p.id] || seen.has(p.id)) continue;
        seen.add(p.id);
        suggestions.push(p);
      }
    }
    return h(
      "section",
      { class: "settings-section" },
      h("p", { class: "settings-hint", text: t(scope.list ? "list.params.hint" : "settings.params.hint") }),
      refPicker,
      grid,
      removed.length
        ? h(
          "div",
          { class: "removed" },
          h("p", { class: "settings-hint", text: t("settings.params.restore") }),
          h(
            "div",
            { class: "chip-row" },
            removed.map((d) => h("button", { class: "chip", type: "button", onclick: () => restoreParam(scope, d.id) }, icon("plus", 14), t(`param.${d.id}`)))
          )
        )
        : null,
      suggestions.length
        ? h(
          "div",
          { class: "removed" },
          h("p", { class: "settings-hint", text: t("param.suggest.hint") }),
          h(
            "div",
            { class: "chip-row" },
            suggestions.map((p) =>
              h("button", {
                class: "chip",
                type: "button",
                onclick: () => {
                  const copy = clone(p);
                  delete copy.ref;
                  scopeParams(scope).push(copy);
                  afterParamsChange(scope);
                  scope.rerender();
                },
              }, icon("plus", 14), p.name)
            )
          )
        )
        : null,
      scope.form
        ? paramFormElement(scope)
        : h("button", {
          class: "text-btn",
          type: "button",
          text: t("param.add"),
          onclick: () => {
            scope.form = newParamForm();
            scope.rerender();
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
            list.kind === "linked" ? h("small", { text: t("list.kind.linked.short") }) : null,
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
      },
      {
        versionKey: "about.versions.v006.label",
        dateKey: "about.versions.v006.date",
        titleKey: "about.versions.v006.title",
        bodyKey: "about.versions.v006.body",
        openByDefault: false
      },
      {
        versionKey: "about.versions.v007.label",
        dateKey: "about.versions.v007.date",
        titleKey: "about.versions.v007.title",
        bodyKey: "about.versions.v007.body",
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
        ? paramsSection(settingsScope)
        : settingsView === "lists"
          ? listsSection()
          : settingsView === "about"
            ? aboutSection()
            : settingsMenu()
    );
  }

  /* ------------------------------------------------------------------------
     Ventana de una lista: nombre y, en tres apartados, sus parámetros, su aspecto y su orden.
     Además: tareas completadas, ocultar y eliminar
     ------------------------------------------------------------------------ */
  let editingListId = null;
  let deleteArmed = false;
  let listTab = "params"; // "source" (solo dependientes), "params", "layout", "sort" o "highlight"

  function openListDialog(id, tab) {
    editingListId = id;
    deleteArmed = false;
    listTab = tab || (listById(id).kind === "linked" ? "source" : "params");
    listScope.form = null;
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
    if (expandedId === id) closeFull();
    state.lists = state.lists.filter((l) => l.id !== id);
    state.lists.forEach((l) => (l.links = l.links.filter((k) => k.listId !== id))); // las dependientes dejan de enlazarla
    state.tasks = state.tasks.filter((x) => x.listId !== id);
    titleDrafts.delete(id);
    if (!visibleLists().length) state.lists[0].hidden = false;
    saveState();
    $("list-dialog").close();
    renderGrid();
    if ($("settings-dialog").open) renderSettings();
  }

  // Orden de las tareas de la lista.
  function sortSection(list) {
    const criteria = sortCriteria(list.params);
    // los criterios de parámetros que ya no existen se saltan (se conservan por si el parámetro vuelve)
    const rules = list.sort.filter((r) => criteria.some((c) => c.id === r.by));
    const unused = criteria.find((c) => !rules.some((r) => r.by === c.id));
    return h(
      "section",
      { class: "settings-section" },
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
    );
  }

  // Paleta de colores: unos cuantos fijos y uno libre. onPick recibe el color elegido.
  function colorPicker(color, onPick, { auto = false } = {}) {
    const current = color.toLowerCase();
    const isCustom = current !== "auto" && !PALETTE.includes(current);
    return h(
      "div",
      { class: "swatches", role: "group", "aria-label": t("layout.color") },
      auto
        ? h("button", {
          type: "button",
          class: `swatch swatch-auto${current === "auto" ? " is-selected" : ""}`,
          "aria-label": t("hl.color.auto"),
          title: t("hl.color.auto"),
          "aria-pressed": String(current === "auto"),
          onclick: () => onPick("auto"),
        })
        : null,
      PALETTE.map((preset) =>
        h("button", {
          type: "button",
          class: `swatch${current === preset ? " is-selected" : ""}`,
          style: `--swatch:${preset}`,
          "aria-label": `${t("layout.color")} ${preset}`,
          "aria-pressed": String(current === preset),
          onclick: () => onPick(preset),
        })
      ),
      h("input", {
        type: "color",
        class: `swatch swatch-custom${isCustom ? " is-selected" : ""}`,
        value: isCustom ? color : PALETTE[0],
        "aria-label": t("layout.color.custom"),
        onchange: (event) => onPick(event.target.value),
      })
    );
  }

  // Aspecto de los parámetros en las tareas de la lista: cómo se ve cada uno y en qué orden.
  function layoutSection(list) {
    const entries = layoutOf(list);
    const changed = () => {
      saveState();
      renderGrid();
      renderListDialog();
    };
    const move = (index, by) => {
      const a = list.layout.indexOf(entries[index]);
      const b = list.layout.indexOf(entries[index + by]);
      [list.layout[a], list.layout[b]] = [list.layout[b], list.layout[a]];
      changed();
    };

    return h(
      "section",
      { class: "settings-section" },
      h("p", { class: "settings-hint", text: t("list.layout.hint") }),
      entries.map((entry, i) => {
        const info = paramById(list.params, entry.id);
        const options = STYLES.filter((style) => !(style === "hidden" && info.locked)).map((style) => ({ value: style, label: t(`style.${style}`) }));
        const arrow = (by, name, glyph) =>
          (by < 0 ? i > 0 : i < entries.length - 1)
            ? h("button", { class: "icon-btn small", type: "button", "aria-label": `${t(name)}: ${info.name}`, onclick: () => move(i, by) }, icon(glyph, 16))
            : h("span");
        return h(
          "div",
          { class: "layout-row" },
          h(
            "div",
            { class: "layout-head" },
            h("span", { class: "layout-name", text: info.name }),
            dropdown({
              value: entry.style,
              label: `${t("layout.style")}: ${info.name}`,
              options,
              onChange: (style) => {
                entry.style = style;
                changed();
              },
            }),
            arrow(-1, "layout.up", "up"),
            arrow(1, "layout.down", "chevronDown")
          ),
          entry.style === "badge" && info.type !== "select" // en las listas desplegables el color lo da cada opción
            ? colorPicker(entry.color, (color) => {
              entry.color = color;
              changed();
            })
            : null
        );
      })
    );
  }

  // Editor de requisitos sobre parámetros (resaltado y requisitos de las dependientes). "target" es { match, groups }:
  // cada grupo tiene sus condiciones, que se cumplen todas (Y) o alguna (O), y los grupos se unen entre sí con Y u O.
  // Devuelve los grupos con sus filas y los botones de añadir.
  function requirementsEditor(target, params, rebuild, apply, labelKey = "hl.match.label") {
    const infos = new Map(params.map((p) => [p.id, p]));
    const opsFor = (info) => HL_OPS[hlGroup(info.type)] || [];

    const newCondition = () => {
      const first = params.find((p) => p.id === "due") || params[0];
      const op = opsFor(first)[0];
      return { param: first.id, op, value: defaultConditionValue(op, first) };
    };

    const conditionRow = (group, cond) => {
      const info = infos.get(cond.param);
      const remove = h("button", {
        class: "icon-btn small",
        type: "button",
        "aria-label": t("hl.remove"),
        onclick: () => {
          group.conditions.splice(group.conditions.indexOf(cond), 1);
          if (!group.conditions.length) target.groups.splice(target.groups.indexOf(group), 1); // un grupo vacío desaparece
          rebuild();
        },
      }, icon("close", 16));
      if (!info) return h("div", { class: "hl-row" }, h("div", { class: "hl-line hl-missing" }, h("span", { text: t("hl.missing") }), remove));

      const paramSelect = dropdown({
        value: cond.param,
        label: t("hl.param"),
        options: params.map((p) => ({ value: p.id, label: p.name })),
        onChange: (id) => {
          cond.param = id;
          cond.op = opsFor(infos.get(id))[0];
          cond.value = defaultConditionValue(cond.op, infos.get(id));
          rebuild();
        },
      });
      const opSelect = dropdown({
        value: cond.op,
        label: t("hl.op"),
        options: opsFor(info).map((op) => ({ value: op, label: t(`hl.op.${op}`) })),
        onChange: (op) => {
          if (HL_NEEDS[op] !== HL_NEEDS[cond.op]) cond.value = defaultConditionValue(op, info);
          cond.op = op;
          rebuild();
        },
      });

      const needs = HL_NEEDS[cond.op];
      let value = null;
      if (needs === "number") {
        value = h("input", {
          class: "field",
          type: "number",
          inputmode: "decimal",
          step: "any",
          value: cond.value,
          "aria-label": t("hl.value"),
          oninput: (event) => {
            cond.value = event.target.value === "" ? "" : Number(event.target.value);
            apply();
          },
        });
      } else if (needs === "text") {
        value = h("input", {
          class: "field",
          type: "text",
          maxlength: 60,
          value: cond.value,
          placeholder: t("hl.value"),
          "aria-label": t("hl.value"),
          oninput: (event) => {
            cond.value = event.target.value;
            apply();
          },
        });
      } else if (needs === "select") {
        value = dropdown({
          value: cond.value,
          label: t("hl.value"),
          options: (info.options || []).map((o) => ({ value: o.id, label: o.label, color: o.color })),
          onChange: (v) => {
            cond.value = v;
            apply();
          },
        });
      }
      return h("div", { class: "hl-row" }, h("div", { class: "hl-line" }, paramSelect, opSelect, remove), value ? h("div", { class: "hl-value" }, value) : null);
    };

    // Y / O: "all" (todas) o "any" (alguna)
    const matchPicker = (value, label, onChange) =>
      dropdown({
        value,
        label,
        options: [{ value: "all", label: t("req.all") }, { value: "any", label: t("req.any") }],
        onChange,
      });

    const many = target.groups.length > 1;
    const out = [];
    target.groups.forEach((group, index) => {
      if (index > 0) {
        out.push(
          h(
            "div",
            { class: "req-between" },
            h("span", { class: "field-label", text: t("req.between.label") }),
            dropdown({
              value: target.match,
              label: t("req.between.label"),
              options: [{ value: "all", label: t("req.between.all") }, { value: "any", label: t("req.between.any") }],
              onChange: (match) => {
                target.match = match;
                rebuild(); // el mismo ajuste se ve entre todos los grupos
              },
            })
          )
        );
      }
      const body = [
        ...group.conditions.map((cond) => conditionRow(group, cond)),
        h("button", {
          class: "text-btn",
          type: "button",
          text: t("hl.add"),
          onclick: () => {
            group.conditions.push(newCondition());
            rebuild();
          },
        }),
        group.conditions.length > 1
          ? h(
            "div",
            { class: "field-group" },
            h("span", { class: "field-label", text: t(many ? "req.within.label" : labelKey) }),
            matchPicker(group.match, t(many ? "req.within.label" : labelKey), (match) => {
              group.match = match;
              apply();
            })
          )
          : null,
      ];
      out.push(
        many
          ? h(
            "div",
            { class: "req-group" },
            h(
              "div",
              { class: "req-head" },
              h("span", { class: "field-label", text: t("req.group", { n: index + 1 }) }),
              h("button", {
                class: "icon-btn small",
                type: "button",
                "aria-label": `${t("req.group.remove")}: ${index + 1}`,
                onclick: () => {
                  target.groups.splice(index, 1);
                  rebuild();
                },
              }, icon("close", 16))
            ),
            ...body
          )
          : h("div", { class: "req-flat" }, ...body)
      );
    });

    out.push(
      h("button", {
        class: "text-btn",
        type: "button",
        text: t(target.groups.length ? "req.addGroup" : "hl.add"),
        onclick: () => {
          target.groups.push({ match: "all", conditions: [newCondition()] });
          rebuild();
        },
      })
    );
    return out;
  }

  // Resaltado: condiciones sobre los parámetros de la lista, color y parpadeo.
  function highlightSection(list) {
    const hl = list.highlight;
    const rebuild = () => {
      saveState();
      renderGrid();
      renderListDialog();
    };
    const apply = () => {
      saveState();
      renderGrid();
    };
    return h(
      "section",
      { class: "settings-section" },
      h("p", { class: "settings-hint", text: t("list.highlight.hint") }),
      ...requirementsEditor(hl, highlightParams(list.params), rebuild, apply, "hl.match.label"),
      h(
        "div",
        { class: "field-group" },
        h("span", { class: "field-label", text: t("hl.color") }),
        colorPicker(hl.color, (color) => {
          hl.color = color;
          rebuild();
        }, { auto: true })
      ),
      h(
        "label",
        { class: "check-row" },
        h("input", {
          type: "checkbox",
          checked: hl.blink,
          onchange: (event) => {
            hl.blink = event.target.checked;
            apply();
          },
        }),
        t("hl.blink")
      )
    );
  }

  // Origen de una lista dependiente: de qué listas salen las tareas y qué requisitos tienen que cumplir.
  // Sus parámetros son todos los distintos de esas listas, y con ellos se configuran requisitos, aspecto y orden.
  function sourceSection(list) {
    const rebuild = () => {
      saveState();
      renderGrid();
      renderListDialog();
    };
    const apply = () => {
      saveState();
      renderGrid();
    };

    const picks = ownLists().map((source) =>
      h(
        "label",
        { class: "check-row" },
        h("input", {
          type: "checkbox",
          checked: list.links.some((k) => k.listId === source.id),
          onchange: (event) => {
            if (event.target.checked) list.links.push({ listId: source.id });
            else list.links = list.links.filter((k) => k.listId !== source.id);
            syncLinkedParams(list);
            rebuild();
          },
        }),
        listName(source)
      )
    );

    return h(
      "section",
      { class: "settings-section" },
      h("p", { class: "settings-hint", text: t("link.hint") }),
      h("p", { class: "field-label", text: t("link.lists") }),
      h("div", { class: "check-group stacked" }, picks),
      h(
        "div",
        { class: "link-block" },
        h("p", { class: "field-label", text: t("link.filter") }),
        h("p", { class: "settings-hint", text: t("link.filter.hint") }),
        ...requirementsEditor(list.filter, highlightParams(list.params), rebuild, apply, "link.match.label")
      )
    );
  }

  function renderListDialog() {
    const list = state.lists.find((l) => l.id === editingListId);
    if (!list) return;
    listScope.list = list;
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

    const linked = list.kind === "linked";
    if (!linked && listTab === "source") listTab = "params";
    if (linked && listTab === "params") listTab = "source"; // una dependiente no tiene parámetros propios
    const tabs = segmented({
      label: t("list.tabs"),
      options: [
        linked ? { value: "source", label: t("list.tab.source") } : { value: "params", label: t("list.tab.params") },
        { value: "layout", label: t("list.tab.layout") },
        { value: "sort", label: t("list.tab.sort") },
        { value: "highlight", label: t("list.tab.highlight") },
      ],
      value: listTab,
      onChange: (tab) => {
        listTab = tab;
        listScope.form = null;
        renderListDialog();
      },
    });

    const section =
      listTab === "source"
        ? sourceSection(list)
        : listTab === "layout"
        ? layoutSection(list)
        : listTab === "sort"
          ? sortSection(list)
          : listTab === "highlight"
            ? highlightSection(list)
            : h("section", { class: "settings-section" }, paramsSection(listScope));

    $("list-body").replaceChildren(
      h("div", { class: "field-group" }, h("label", { class: "field-label", for: "list-name-input", text: t("list.name") }), nameInput),
      h("div", { class: "list-tabs" }, tabs),
      section,
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
        disabled: state.lists.length === 1 || (list.kind === "own" && ownLists().length === 1), // siempre queda una independiente
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
  Flucti.bindDialog(newDialog);
  $("new-close").addEventListener("click", () => newDialog.close());

  $("menu-btn").addEventListener("click", () => {
    settingsView = null;
    settingsScope.form = null;
    renderSettings();
    Flucti.openDialog(settingsDialog);
  });
  $("settings-back").addEventListener("click", () => {
    settingsView = null;
    settingsScope.form = null;
    renderSettings();
  });
  $("settings-close").addEventListener("click", () => settingsDialog.close());
  $("list-close").addEventListener("click", () => listDialog.close());
  listDialog.addEventListener("close", () => {
    renderGrid();
    if (settingsDialog.open) renderSettings();
  });

  $("task-delete-btn").addEventListener("click", () => {
    if (!draft || !draft.editingTaskId) return;
    if (!deleteTaskArmed) {
      deleteTaskArmed = true;
      paintDeleteTask();
      clearTimeout(deleteTaskTimer);
      deleteTaskTimer = setTimeout(() => {
        deleteTaskArmed = false;
        if (draft) paintDeleteTask();
      }, 4000);
      return;
    }
    const id = draft.editingTaskId;
    clearTimeout(deleteTaskTimer);
    deleteTaskArmed = false;
    state.tasks = state.tasks.filter((x) => x.id !== id);
    saveState();
    closeTaskDialog(); // sin borrador: al cerrarse no se guarda nada
    renderGrid();
  });

  $("task-close").addEventListener("click", () => attemptCloseTask(false));
  $("task-save-btn").addEventListener("click", () => attemptCloseTask(true));
  taskDialog.addEventListener("close", () => {
    const typed = draft && !draft.editingTaskId ? draftRefText() : "";
    if (typed) {
      titleDrafts.set(draft.listId, typed);
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
    if (newDialog.open) renderNewMenu();
    if (taskDialog.open && draft) renderTaskDialog();
  });

  // Las fechas relativas ("Mañana") cambian con el día: se refrescan cada minuto y al volver a la pestaña,
  // sin interrumpir si se está escribiendo o hay una ventana abierta.
  const refresh = () => {
    if (!focusedKey && !Flucti.dragging && [...Flucti.openDialogs].every((d) => d === fullView)) renderGrid(); // la lista a pantalla completa también se refresca
  };
  setInterval(refresh, 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });

  // Al cambiar el ancho o cargarse la tipografía cambia la altura de las tarjetas: se vuelven a repartir.
  let gridWidth = 0;
  let frame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const width = $("lists-grid").clientWidth;
      if (width === gridWidth) return;
      gridWidth = width;
      rebalance();
    });
  });
  wide.addEventListener("change", rebalance);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebalance);

  // Ctrl+Z deshace el último cambio y Ctrl+Mayús+Z (o Ctrl+Y) lo rehace. En un campo de texto manda el propio campo
  // (deshace lo que se escribe), salvo en el recuadro de añadir tareas cuando está vacío, que no tiene nada que deshacer.
  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    const wantsRedo = key === "y" || (key === "z" && event.shiftKey);
    const wantsUndo = key === "z" && !event.shiftKey;
    if (!wantsUndo && !wantsRedo) return;
    const target = event.target;
    const field = target.closest ? target.closest("input, textarea, select, [contenteditable='true']") : null;
    if (field && !(field.classList.contains("add-input") && !field.value)) return;
    if (taskDialog.open || Flucti.dragging) return;
    event.preventDefault();
    if (wantsRedo) redo();
    else undo();
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
    layoutOf,
    makeList,
    undo,
    redo,
  };
})();