"use strict";

(() => {
  /* ------------------------------------------------------------------------
     Reloj, saludo y cielo dinámico (según Igualada y época del año)
     ------------------------------------------------------------------------ */
  const hmEl = document.getElementById("time-hm");
  const sEl = document.getElementById("time-s");
  const greetingEl = document.getElementById("greeting");

  const pad = (n) => String(n).padStart(2, "0");

  // Cálculo astronómico de salida, mediodía y puesta de sol para Igualada (Lat: 41.5833, Lon: 1.6167)
  function getSolarTimes(date) {
    const LAT = 41.5833;
    const LON = 1.6167;

    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date - startOfYear) / (1000 * 60 * 60 * 24)) + 1;

    const rad = Math.PI / 180;
    const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (date.getHours() - 12) / 24);

    const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

    const cosHourAngle = (Math.cos(90.833 * rad) - Math.sin(LAT * rad) * Math.sin(decl)) / (Math.cos(LAT * rad) * Math.cos(decl));
    const hourAngle = cosHourAngle >= 1 ? 0 : cosHourAngle <= -1 ? Math.PI : Math.acos(cosHourAngle);

    const solarNoonUTC = 720 - 4 * LON - eqtime;
    const sunriseUTC = solarNoonUTC - (hourAngle * 180 / Math.PI) * 4;
    const sunsetUTC = solarNoonUTC + (hourAngle * 180 / Math.PI) * 4;

    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    // Convierte minutos UTC a objetos Date absolutos para comparar correctamente con 'now'
    const toDate = (minutes) => new Date(Date.UTC(year, month, day, 0, minutes));

    return {
      sunrise: toDate(sunriseUTC),
      solarNoon: toDate(solarNoonUTC),
      sunset: toDate(sunsetUTC)
    };
  }

  // Modificamos para aceptar una fecha de prueba opcional
  function updateClock(testDate) {
    const now = testDate || new Date(); // Si le pasamos una fecha de prueba, la usa; si no, la real.
    
    hmEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    sEl.textContent = `:${pad(now.getSeconds())}`;

    const solar = getSolarTimes(now);
    
    let greeting = "Buenas noches";
    let skyPhase = "night";

    if (now >= solar.sunrise && now < solar.solarNoon) {
      greeting = "Buenos días";
      const hoursSinceSunrise = (now - solar.sunrise) / (1000 * 60 * 60);
      skyPhase = hoursSinceSunrise < 1.5 ? "dawn" : "morning";
    } else if (now >= solar.solarNoon && now < solar.sunset) {
      greeting = "Buenas tardes";
      const hoursBeforeSunset = (solar.sunset - now) / (1000 * 60 * 60);
      skyPhase = hoursBeforeSunset < 1.5 ? "sunset" : (hoursBeforeSunset < 4 ? "afternoon" : "noon");
    } else {
      skyPhase = "night";
    }

    if (greetingEl.textContent !== greeting) greetingEl.textContent = greeting;
    
    if (document.body.dataset.sky !== skyPhase) {
      document.body.dataset.sky = skyPhase;
    }
  }

  // Se sincroniza con el cambio de segundo para que el reloj no se retrase.
  function tick() {
    updateClock();
    setTimeout(tick, 1000 - (Date.now() % 1000) + 10);
  }

  /* ------------------------------------------------------------------------
     Tareas
     ------------------------------------------------------------------------ */
  const STORAGE_KEY = "tareas:v1";
  const STRIKE_DELAY = 380; 
  const LEAVE_DURATION = 320; 

  const form = document.getElementById("add-form");
  const input = document.getElementById("task-input");
  const list = document.getElementById("task-list");
  const emptyEl = document.getElementById("empty");

  function loadTasks() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(data)) return [];
      return data.filter((t) => t && typeof t.id === "string" && typeof t.name === "string");
    } catch {
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      /* Sin almacenamiento disponible */
    }
  }

  const newId = () =>
    window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  let tasks = loadTasks();

  function updateEmpty() {
    emptyEl.hidden = tasks.length > 0;
  }

  function createTaskElement(task, animate) {
    const li = document.createElement("li");
    li.className = "task" + (animate ? " entering" : "");
    li.dataset.id = task.id;

    const row = document.createElement("div");
    row.className = "task-row";

    const content = document.createElement("div");
    content.className = "task-content";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "check";
    check.setAttribute("aria-label", `Completar tarea: ${task.name}`);

    const name = document.createElement("span");
    name.className = "task-name";
    name.textContent = task.name;

    content.append(check, name);
    row.append(content);
    li.append(row);
    return li;
  }

  function completeTask(li) {
    if (li.classList.contains("done")) return;
    li.classList.add("done");

    tasks = tasks.filter((t) => t.id !== li.dataset.id);
    saveTasks();

    setTimeout(() => {
      li.classList.add("leaving");
      setTimeout(() => {
        li.remove();
        updateEmpty();
      }, LEAVE_DURATION);
    }, STRIKE_DELAY);
  }

  list.addEventListener("change", (event) => {
    const check = event.target;
    if (!check.classList.contains("check") || !check.checked) return;
    completeTask(check.closest(".task"));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = input.value.trim().replace(/\s+/g, " ");
    if (!name) {
      input.focus();
      return;
    }

    const task = { id: newId(), name };
    tasks.unshift(task);
    saveTasks();

    list.prepend(createTaskElement(task, true));
    input.value = "";
    input.focus();
    updateEmpty();
  });

  /* ------------------------------------------------------------------------
     Navegación entre los dos estados: inicio y tareas
     ------------------------------------------------------------------------ */
  const tasksSection = document.getElementById("tareas");
  const hint = document.querySelector(".scroll-hint");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const MOVE_DURATION = 800;

  let locked = false;
  let lockTimer;

  const tasksTop = () => tasksSection.offsetTop;
  const inHome = () => window.scrollY < tasksTop() - 2;
  const atTasksTop = () => Math.abs(window.scrollY - tasksTop()) <= 2;

  function goTo(top) {
    if (locked) return;
    locked = true;
    window.scrollTo({ top, behavior: reduceMotion.matches ? "auto" : "smooth" });
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => {
      locked = false;
    }, reduceMotion.matches ? 50 : MOVE_DURATION);
  }

  const goDown = () => goTo(tasksTop());
  const goUp = () => goTo(0);

  let lastWheel = 0;
  let wheelStartedAtTop = false;

  window.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) return;

      const now = performance.now();
      if (now - lastWheel > 200) wheelStartedAtTop = atTasksTop();
      lastWheel = now;

      if (locked) {
        event.preventDefault();
        return;
      }

      if (event.deltaY > 0 && inHome()) {
        event.preventDefault();
        goDown();
      } else if (
        event.deltaY < 0 &&
        window.scrollY > 0 &&
        ((wheelStartedAtTop && atTasksTop()) || inHome())
      ) {
        event.preventDefault();
        goUp();
      }
    },
    { passive: false }
  );

  let touchStartY = 0;
  let touchStartedAtTop = false;

  window.addEventListener(
    "touchstart",
    (event) => {
      touchStartY = event.touches[0].clientY;
      touchStartedAtTop = atTasksTop();
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (event) => {
      const swipe = touchStartY - event.touches[0].clientY;

      if (locked || inHome()) {
        if (event.cancelable) event.preventDefault();
        if (locked) return;
        if (swipe > 8) goDown();
        else if (swipe < -8 && window.scrollY > 0) goUp();
        return;
      }

      if (swipe < -8 && touchStartedAtTop && atTasksTop()) {
        if (event.cancelable) event.preventDefault();
        goUp();
      }
    },
    { passive: false }
  );

  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const target = event.target;
    if (target.matches("input, textarea, select")) return;
    const onPage = target === document.body || target === document.documentElement;

    const down = ["ArrowDown", "PageDown", "End"].includes(event.key) || (event.key === " " && onPage);
    const up = ["ArrowUp", "PageUp", "Home"].includes(event.key);

    if (down && inHome()) {
      event.preventDefault();
      goDown();
    } else if (up && window.scrollY > 0 && (atTasksTop() || inHome())) {
      event.preventDefault();
      goUp();
    }
  });

  hint.addEventListener("click", (event) => {
    event.preventDefault();
    goDown();
  });

  tasks.forEach((task) => list.append(createTaskElement(task, false)));
  updateEmpty();
  tick();
  window.updateClock = updateClock;
})();