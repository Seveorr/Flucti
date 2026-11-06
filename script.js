"use strict";

(() => {
  /* ------------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------------ */
  const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
  const smoothstep = (x) => {
    const t = clamp(x, 0, 1);
    return t * t * (3 - 2 * t);
  };
  const pad = (n) => String(n).padStart(2, "0");

  /* ------------------------------------------------------------------------
     Ubicación
     Se pide la ubicación al navegador y se guarda (redondeada, ~1 km) solo en
     este dispositivo. Si se deniega o no está disponible, se usa la última
     guardada y, en su defecto, Igualada.
     ------------------------------------------------------------------------ */
  const DEFAULT_PLACE = { lat: 41.5833, lon: 1.6167 }; // Igualada
  const PLACE_KEY = "location:v1";
  const LEGACY_PLACE_KEY = "ubicacion:v1"; // nombre antiguo, se sigue leyendo

  function loadPlace() {
    try {
      const raw = localStorage.getItem(PLACE_KEY) || localStorage.getItem(LEGACY_PLACE_KEY);
      const saved = JSON.parse(raw || "null");
      if (saved && Math.abs(saved.lat) <= 90 && Math.abs(saved.lon) <= 180) return { lat: saved.lat, lon: saved.lon };
    } catch {
      /* se ignora */
    }
    return null;
  }

  function savePlace(p) {
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify(p));
    } catch {
      /* Sin almacenamiento disponible */
    }
  }

  let place = loadPlace() || DEFAULT_PLACE;
  let skyDirty = true; // fuerza recalcular el cielo (cambio de ubicación, prueba, etc.)

  function requestPlace() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        if (lat === place.lat && lon === place.lon) return;
        place = { lat, lon };
        savePlace(place);
        skyDirty = true;
        updateClock();
        fetchWeather(place);
      },
      () => {
        /* Denegada o no disponible: se mantiene la ubicación actual. */
      },
      { maximumAge: 6 * 60 * 60 * 1000, timeout: 15000 }
    );
  }

  /* ------------------------------------------------------------------------
     Tiempo atmosférico (Open-Meteo, sin clave) y modo de pruebas
     Un "weather" es { kind, intensity, clearness }:
     kind: clear | cloudy | fog | rain | snow | storm; intensity y clearness de 0 a 1.
     Se consulta cada 15 min para la ubicación activa; si falla, se trata como nublado.
     ------------------------------------------------------------------------ */
  const WMO = {
    45: ["fog", 0.7], 48: ["fog", 0.8],
    51: ["rain", 0.2], 53: ["rain", 0.3], 55: ["rain", 0.45], 56: ["rain", 0.35], 57: ["rain", 0.5],
    61: ["rain", 0.4], 63: ["rain", 0.7], 65: ["rain", 1], 66: ["rain", 0.6], 67: ["rain", 0.9],
    71: ["snow", 0.4], 73: ["snow", 0.7], 75: ["snow", 1], 77: ["snow", 0.4],
    80: ["rain", 0.5], 81: ["rain", 0.75], 82: ["rain", 1], 85: ["snow", 0.6], 86: ["snow", 0.9],
    95: ["storm", 0.7], 96: ["storm", 0.9], 99: ["storm", 1],
  };

  function weatherFromCode(code) {
    if (code === 0) return { kind: "clear", intensity: 0, clearness: 1 };
    if (code === 1) return { kind: "clear", intensity: 0, clearness: 0.8 };
    if (code === 2) return { kind: "clear", intensity: 0, clearness: 0.35 };
    const [kind, intensity] = WMO[code] || ["cloudy", 0];
    return { kind, intensity, clearness: 0 };
  }

  const weatherCache = {};
  const placeKey = (p) => `${p.lat.toFixed(1)},${p.lon.toFixed(1)}`;

  let testState = null; // { until, offset, place, weather } mientras dura una prueba
  const activePlace = () => (testState && testState.place) || place;
  const activeWeather = () => (testState && testState.weather) || weatherCache[placeKey(activePlace())] || null;
  const currentDate = () => new Date(Date.now() + (testState ? testState.offset : 0));

  async function fetchWeather(p) {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=weather_code`);
      if (!res.ok) return;
      const code = (await res.json()).current?.weather_code;
      if (typeof code !== "number") return;
      weatherCache[placeKey(p)] = weatherFromCode(code);
      if (placeKey(p) === placeKey(activePlace())) {
        skyDirty = true;
        updateClock();
      }
    } catch {
      /* Sin conexión: se mantiene el último tiempo conocido. */
    }
  }

  // --- Pruebas desde la consola: testSky({ weather, time, place, intensity, duration }) ---
  const normalize = (str) => String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const TEST_WEATHERS = {
    clear: ["clear", 0, 1], sunny: ["clear", 0, 1], partly: ["clear", 0, 0.35],
    cloudy: ["cloudy", 0, 0], fog: ["fog", 0.7, 0],
    drizzle: ["rain", 0.25, 0], rain: ["rain", 0.6, 0], downpour: ["rain", 1, 0],
    snow: ["snow", 0.6, 0], blizzard: ["snow", 1, 0], storm: ["storm", 0.8, 0],
  };

  const TEST_PLACES = {
    igualada: { lat: 41.58, lon: 1.62 }, barcelona: { lat: 41.39, lon: 2.17 }, london: { lat: 51.51, lon: -0.13 },
    "new york": { lat: 40.71, lon: -74.01 }, tokyo: { lat: 35.68, lon: 139.69 }, sydney: { lat: -33.87, lon: 151.21 },
    quito: { lat: -0.18, lon: -78.47 }, reykjavik: { lat: 64.15, lon: -21.94 }, tromso: { lat: 69.65, lon: 18.96 },
    singapore: { lat: 1.35, lon: 103.82 }, "cape town": { lat: -33.92, lon: 18.42 },
  };

  function parseTime(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
    if (match) {
      const d = new Date();
      d.setHours(+match[1], +match[2], 0, 0);
      return d.getTime();
    }
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? null : t;
  }

  function testSky(options) {
    if (options === undefined || options === null) {
      testState = null;
      skyDirty = true;
      updateClock();
      console.info("Sky: back to real state.");
      return;
    }
    if (typeof options !== "object") {
      console.info(
        "testSky({ weather, time, place, intensity, duration })\n" +
          `  weather:   ${Object.keys(TEST_WEATHERS).join(", ")}\n` +
          '  time:      "14:30" (device time), "2026-06-21T05:30" or "2026-06-21T05:30:00Z"\n' +
          `  place:     ${Object.keys(TEST_PLACES).join(", ")} or { lat, lon }\n` +
          "  intensity: 0 to 1 (rain, snow, storm, fog)\n" +
          "  duration:  seconds (default 60). Then it goes back to the real state.\n" +
          "  testSky()  goes back to the real state right away."
      );
      return;
    }

    const { weather, time, place: testPlace, intensity, duration = 60 } = options;
    const next = { until: Date.now() + duration * 1000, offset: 0, place: null, weather: null };

    if (time !== undefined) {
      const t = parseTime(time);
      if (t === null) console.warn("testSky: invalid time.");
      else next.offset = t - Date.now();
    }
    if (testPlace !== undefined) {
      const p = typeof testPlace === "object" ? testPlace : TEST_PLACES[normalize(testPlace)];
      if (p && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180) next.place = { lat: p.lat, lon: p.lon };
      else console.warn(`testSky: invalid place. Options: ${Object.keys(TEST_PLACES).join(", ")} or { lat, lon }.`);
    }
    if (weather !== undefined) {
      const w = TEST_WEATHERS[normalize(weather)];
      if (w) next.weather = { kind: w[0], intensity: clamp(intensity ?? w[1], 0, 1), clearness: w[2] };
      else console.warn(`testSky: invalid weather. Options: ${Object.keys(TEST_WEATHERS).join(", ")}.`);
    }

    testState = next;
    skyDirty = true;
    if (next.place && !next.weather) fetchWeather(next.place); // el tiempo real de ese lugar
    updateClock();
    console.info(`Testing the sky for ${duration} s; then it goes back to the real state.`);
  }

  /* ------------------------------------------------------------------------
     Posición del sol (fórmulas NOAA, todo en UTC)
     ------------------------------------------------------------------------ */
  const RAD = Math.PI / 180;
  const SUN_HORIZON = -0.833; // salida/puesta de sol (refracción + radio del disco)

  function sunPosition(date, latDeg, lonDeg) {
    const lat = clamp(latDeg, -89.9, 89.9);
    const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    const year = date.getUTCFullYear();
    const dayOfYear = Math.floor((Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - Date.UTC(year, 0, 1)) / 86400000) + 1;
    const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (utcMinutes / 60 - 12) / 24);

    const equationOfTime =
      229.18 *
      (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    const declination =
      0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

    // Ángulo horario en grados: negativo antes del mediodía solar, positivo después.
    const trueSolarMinutes = (((utcMinutes + equationOfTime + 4 * lonDeg) % 1440) + 1440) % 1440;
    const hourAngle = trueSolarMinutes / 4 - 180;

    const latRad = lat * RAD;
    const sinElevation =
      Math.sin(latRad) * Math.sin(declination) + Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle * RAD);
    const elevation = Math.asin(clamp(sinElevation, -1, 1)) / RAD;

    // Mitad del arco diurno en grados (0 = noche polar, 180 = sol de medianoche).
    const cosHalfDay =
      (Math.cos(90.833 * RAD) - Math.sin(latRad) * Math.sin(declination)) / (Math.cos(latRad) * Math.cos(declination));
    const halfDay = Math.acos(clamp(cosHalfDay, -1, 1)) / RAD;

    return { elevation, hourAngle, halfDay };
  }

  /* ------------------------------------------------------------------------
     Color: mezcla en OKLab (los tonos intermedios no se ven apagados)
     ------------------------------------------------------------------------ */
  const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

  function hexToLab(hex) {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    const n = parseInt(match ? match[1] : "808080", 16);
    const r = srgbToLinear(((n >> 16) & 255) / 255);
    const g = srgbToLinear(((n >> 8) & 255) / 255);
    const b = srgbToLinear((n & 255) / 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  }

  function labToLinearRgb([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, 0, 1),
      clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, 0, 1),
      clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s, 0, 1),
    ];
  }

  const labToHex = (lab) =>
    "#" +
    labToLinearRgb(lab)
      .map((c) => Math.round(clamp(linearToSrgb(c), 0, 1) * 255).toString(16).padStart(2, "0"))
      .join("");

  const mixLab = (x, y, t) => x.map((v, i) => v + (y[i] - v) * t);

  // Luminancia y contraste (WCAG) de un color en OKLab.
  function luminance(lab) {
    const [r, g, b] = labToLinearRgb(lab);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrast(x, y) {
    const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Las paletas viven en style.css (--sky-night, --sky-morning…), en este orden:
  const TOKENS = ["bg", "surface", "ink", "muted", "line", "accent", "accentInk"];
  const palettes = {};

  function palette(name) {
    if (!palettes[name]) {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(`--sky-${name}`).trim().split(/\s+/);
      palettes[name] = Object.fromEntries(TOKENS.map((token, i) => [token, hexToLab(raw[i])]));
    }
    return palettes[name];
  }

  // Si el texto pasa de claro a oscuro entre dos paletas (o al revés), no se
  // mezcla: en cada instante se usa el extremo que mejor se lee sobre el fondo
  // actual, para no tener nunca un texto del mismo tono que el fondo.
  function mixText(x, y, t, background) {
    if (t <= 0) return x;
    if (t >= 1) return y;
    if (x[0] > 0.6 === y[0] > 0.6) return mixLab(x, y, t);
    return contrast(x, background) >= contrast(y, background) ? x : y;
  }

  function blend(a, b, t) {
    const out = {};
    for (const token of ["bg", "surface", "line", "accent"]) out[token] = mixLab(a[token], b[token], t);
    out.ink = mixText(a.ink, b.ink, t, out.bg);
    out.muted = mixText(a.muted, b.muted, t, out.bg);
    if (contrast(out.muted, out.bg) < 3) out.muted = out.ink; // a medio camino entre dos paletas, el texto atenuado se leería mal
    out.accentInk = mixText(a.accentInk, b.accentInk, t, out.accent);
    return out;
  }

  // Paleta completa a partir de un solo color de fondo (texto, líneas, etc. por contraste).
  function deriveTheme(bg) {
    const dark = bg[0] < 0.56;
    const tint = (lightness, amount) => [lightness, bg[1] * amount, bg[2] * amount];
    const ink = dark ? tint(0.96, 0.12) : tint(0.2, 0.3);
    const inverseInk = dark ? tint(0.2, 0.3) : tint(0.96, 0.12); // para el texto sobre el acento
    let muted = mixLab(ink, bg, 0.32);
    if (contrast(muted, bg) < 3.2) muted = mixLab(ink, bg, 0.15);
    return {
      bg,
      surface: [Math.min(bg[0] + 0.06, 0.995), bg[1], bg[2]],
      ink,
      muted,
      line: mixLab(bg, ink, 0.16),
      accent: ink,
      accentInk: inverseInk,
    };
  }

  /* ------------------------------------------------------------------------
     Cielo: saludo y colores según el sol
     - Con el sol bajo (de -12° a +14°) el color depende de su altura, con los
       colores reales de la hora azul y la hora dorada (ver --sky-twilight).
     - Con el sol alto, avanza con el porcentaje de luz solar transcurrido.
     ------------------------------------------------------------------------ */
  const NIGHT_END = -12; // por debajo de esta altura es noche cerrada
  const GOLD_TOP = 6; // última parada de la hora dorada
  const DAY_BLEND_END = 14; // a partir de aquí manda la paleta del día

  const DAY_STOPS = [
    [0.0, "morning"],
    [0.4, "noon"],
    [0.5, "noon"],
    [0.72, "afternoon"],
    [1.0, "afternoon"],
  ];

  function dayColors(fraction) {
    for (let i = 0; i < DAY_STOPS.length - 1; i++) {
      const [f0, name0] = DAY_STOPS[i];
      const [f1, name1] = DAY_STOPS[i + 1];
      if (fraction <= f1) {
        const t = f1 > f0 ? smoothstep((fraction - f0) / (f1 - f0)) : 1;
        return blend(palette(name0), palette(name1), t);
      }
    }
    return palette("afternoon");
  }

  let twilightStops = null;

  // Paradas "altura:color" de --sky-twilight, precedidas por la noche.
  function getTwilightStops() {
    if (!twilightStops) {
      const raw = getComputedStyle(document.documentElement).getPropertyValue("--sky-twilight").trim().split(/\s+/);
      twilightStops = [[NIGHT_END, palette("night")]];
      for (const item of raw) {
        const [elevation, hex] = item.split(":");
        if (hex) twilightStops.push([parseFloat(elevation), deriveTheme(hexToLab(hex))]);
      }
    }
    return twilightStops;
  }

  function twilightColors(elevation) {
    const stops = getTwilightStops();
    if (elevation <= stops[0][0]) return stops[0][1];
    for (let i = 0; i < stops.length - 1; i++) {
      const [e0, a] = stops[i];
      const [e1, b] = stops[i + 1];
      if (elevation <= e1) return blend(a, b, (elevation - e0) / (e1 - e0));
    }
    return stops[stops.length - 1][1];
  }

  // El tiempo mezcla la paleta del cielo con una paleta propia (solo de día).
  const WEATHER_PALETTE = { clear: "sunny", fog: "fog", rain: "rain", snow: "snow", storm: "storm" };

  function withWeather(colors, elevation) {
    const weather = activeWeather();
    if (!weather || !WEATHER_PALETTE[weather.kind]) return colors;
    const day = smoothstep((elevation + 3) / 15);
    const k = weather.intensity;
    const strength = {
      clear: 0.85 * weather.clearness,
      fog: 0.6 + 0.2 * k,
      rain: 0.45 + 0.3 * k,
      snow: 0.6,
      storm: 0.7 + 0.25 * k,
    }[weather.kind];
    return blend(colors, palette(WEATHER_PALETTE[weather.kind]), strength * day);
  }

  function getSky(date) {
    const p = activePlace();
    const { elevation, hourAngle, halfDay } = sunPosition(date, p.lat, p.lon);
    const morning = hourAngle < 0;
    const dayFraction = halfDay > 0 ? clamp((hourAngle + halfDay) / (2 * halfDay), 0, 1) : morning ? 0 : 1;

    let colors = twilightColors(elevation);
    if (elevation > GOLD_TOP) {
      colors = blend(colors, dayColors(dayFraction), smoothstep((elevation - GOLD_TOP) / (DAY_BLEND_END - GOLD_TOP)));
    }

    const greeting = elevation > SUN_HORIZON ? (morning ? "Buenos días" : "Buenas tardes") : "Buenas noches";
    return { greeting, colors: withWeather(colors, elevation) };
  }

  let themeMeta = null;

  function applyColors(colors) {
    const root = document.documentElement;
    const hex = {};
    for (const token of TOKENS) hex[token] = labToHex(colors[token]);

    root.style.setProperty("--bg", hex.bg);
    root.style.setProperty("--surface", hex.surface);
    root.style.setProperty("--ink", hex.ink);
    root.style.setProperty("--muted", hex.muted);
    root.style.setProperty("--line", hex.line);
    root.style.setProperty("--accent", hex.accent);
    root.style.setProperty("--accent-ink", hex.accentInk);
    root.style.setProperty("--sheet", labToHex(mixLab(colors.bg, colors.ink, 0.07)));
    root.style.colorScheme = colors.bg[0] < 0.6 ? "dark" : "light";
    fx.setInk(hex.ink, colors.bg[0] < 0.6);

    // La barra del navegador en el móvil toma el color del cielo.
    if (!themeMeta) {
      themeMeta = document.querySelector('meta[name="theme-color"]');
      if (!themeMeta) {
        themeMeta = document.createElement("meta");
        themeMeta.name = "theme-color";
        document.head.append(themeMeta);
      }
    }
    themeMeta.content = hex.bg;
  }

  /* ------------------------------------------------------------------------
     Efectos del tiempo en el fondo: lluvia, nieve, tormenta (rayos) y niebla.
     Se dibujan en un canvas detrás de la hoja de tareas; no hay sol ni luna.
     Con "reducir movimiento" activado no se anima nada.
     ------------------------------------------------------------------------ */
  const fx = (() => {
    const canvas = document.createElement("canvas");
    canvas.className = "weather-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
    const ctx = canvas.getContext("2d");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rand = (a, b) => a + Math.random() * (b - a);

    let width = 0, height = 0, weather = null, ink = "#000000", dark = false;
    let drops = [], flakes = [], blobs = [], bolt = null, nextBoltAt = 0, fade = 0, lastFrame = 0, frameId = 0;

    function seed() {
      drops = []; flakes = []; blobs = [];
      if (!weather) return;
      const k = weather.intensity;
      const area = (width * height) / (1280 * 720);
      if (weather.kind === "rain" || weather.kind === "storm") {
        for (let i = 0; i < (80 + 420 * k) * area; i++) {
          const z = rand(0.5, 1);
          drops.push({ x: rand(-100, width), y: rand(0, height), len: rand(12, 26) * z, speed: rand(750, 1100) * z * (0.8 + 0.4 * k) });
        }
      } else if (weather.kind === "snow") {
        for (let i = 0; i < (50 + 300 * k) * area; i++) {
          const z = rand(0.4, 1);
          flakes.push({ x: rand(0, width), y: rand(0, height), r: rand(1, 3.2) * z + 0.4, speed: rand(35, 90) * z, phase: rand(0, 6.28), sway: rand(0.6, 1.6) });
        }
      } else if (weather.kind === "fog") {
        for (let i = 0; i < 7; i++) {
          blobs.push({ x: rand(0, width), y: rand(0.15 * height, height), r: rand(0.35, 0.7) * Math.max(width, height), speed: rand(8, 22) * (i % 2 ? 1 : -1) });
        }
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function makeBolt(startTime) {
      const main = [], branches = [];
      let x = rand(0.1, 0.9) * width, y = -10;
      main.push([x, y]);
      while (y < height) {
        y += rand(18, 38);
        x += rand(-26, 26);
        main.push([x, y]);
        if (Math.random() < 0.1) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          const branch = [[x, y]];
          let bx = x, by = y;
          for (let i = 0, n = 3 + Math.floor(Math.random() * 5); i < n; i++) {
            by += rand(14, 28);
            bx += dir * rand(6, 24);
            branch.push([bx, by]);
          }
          branches.push(branch);
        }
      }
      return { startTime, main, branches };
    }

    function strokePath(points) {
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }

    function frame(now) {
      if (!weather) return;
      frameId = requestAnimationFrame(frame);
      const dt = Math.min((now - lastFrame) / 1000 || 0, 0.05);
      lastFrame = now;
      fade = Math.min(1, fade + dt / 1.5);
      ctx.clearRect(0, 0, width, height);

      if (drops.length) {
        const wind = weather.kind === "storm" ? 0.28 : 0.12;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.2;
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.35 * fade;
        ctx.beginPath();
        for (const d of drops) {
          d.y += d.speed * dt;
          d.x += d.speed * wind * dt;
          if (d.y > height + 30) { d.y = -d.len; d.x = rand(-100, width); }
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.len * wind, d.y - d.len);
        }
        ctx.stroke();
      }

      if (flakes.length) {
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.55 * fade;
        ctx.beginPath();
        for (const f of flakes) {
          f.y += f.speed * dt;
          f.phase += dt * f.sway;
          if (f.y > height + 5) { f.y = -5; f.x = rand(0, width); }
          const x = f.x + Math.sin(f.phase) * 18;
          ctx.moveTo(x + f.r, f.y);
          ctx.arc(x, f.y, f.r, 0, 6.283);
        }
        ctx.fill();
      }

      if (blobs.length) {
        const rgb = dark ? "190,200,215" : "255,255,255";
        const alpha = (0.1 + 0.12 * weather.intensity) * fade;
        ctx.globalAlpha = 1;
        for (const b of blobs) {
          b.x += b.speed * dt;
          if (b.speed > 0 && b.x - b.r > width) b.x = -b.r;
          if (b.speed < 0 && b.x + b.r < 0) b.x = width + b.r;
          const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
          gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
          gradient.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = gradient;
          ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
        }
      }

      if (weather.kind === "storm") {
        if (!bolt && now >= nextBoltAt) bolt = makeBolt(now);
        if (bolt) {
          const age = (now - bolt.startTime) / 1000;
          // Destello doble y desvanecido (nunca parpadeo rápido continuo).
          const strength = age < 0.08 ? 1 : age < 0.14 ? 0.25 : age < 0.24 ? 1 : Math.max(0, 1 - (age - 0.24) / 0.45);
          if (age > 0.7) {
            bolt = null;
            nextBoltAt = now + rand(2500, 9000) / (0.6 + weather.intensity);
          } else {
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.globalAlpha = 0.12 * strength;
            ctx.fillStyle = "#dfe8ff";
            ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = "rgb(160,185,255)";
            ctx.globalAlpha = 0.35 * strength;
            ctx.lineWidth = 7;
            strokePath(bolt.main);
            ctx.strokeStyle = "#f6f8ff";
            ctx.globalAlpha = strength;
            ctx.lineWidth = 2;
            strokePath(bolt.main);
            ctx.lineWidth = 1;
            bolt.branches.forEach(strokePath);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function setWeather(next) {
      const valid = next && ["rain", "snow", "storm", "fog"].includes(next.kind) && !prefersReducedMotion.matches ? next : null;
      if ((valid && valid.kind) === (weather && weather.kind) && (valid && valid.intensity) === (weather && weather.intensity)) return;
      weather = valid;
      fade = 0;
      bolt = null;
      nextBoltAt = performance.now() + rand(1500, 4000);
      seed();
      cancelAnimationFrame(frameId);
      if (weather) {
        lastFrame = performance.now();
        frameId = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    }

    window.addEventListener("resize", resize);
    resize();

    return {
      setWeather,
      setInk(hex, isDark) {
        ink = hex;
        dark = isDark;
      },
    };
  })();

  /* ------------------------------------------------------------------------
     Reloj, saludo y fecha
     ------------------------------------------------------------------------ */
  const hoursMinutesEl = document.getElementById("time-hm");
  const secondsEl = document.getElementById("time-s");
  const greetingEl = document.getElementById("greeting");
  const dateEl = document.getElementById("date");

  let lastMinute = -1;

  function updateClock(testDate) {
    if (testState && Date.now() >= testState.until) {
      testState = null; // la prueba terminó: vuelve el estado real
      skyDirty = true;
    }
    const now = testDate || currentDate();

    hoursMinutesEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    secondsEl.textContent = `:${pad(now.getSeconds())}`;

    // "Miércoles, 4 de noviembre de 2026"
    const date = now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const dateText = date.charAt(0).toUpperCase() + date.slice(1);
    if (dateEl.textContent !== dateText) dateEl.textContent = dateText;

    // El cielo se recalcula cada minuto (o al cambiar la ubicación).
    const minute = Math.floor(now.getTime() / 60000);
    if (skyDirty || minute !== lastMinute) {
      lastMinute = minute;
      skyDirty = false;

      const sky = getSky(now);
      if (greetingEl.textContent !== sky.greeting) greetingEl.textContent = sky.greeting;
      applyColors(sky.colors);
      fx.setWeather(activeWeather());
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
  const STORAGE_KEY = "tasks:v1";
  const LEGACY_STORAGE_KEY = "tareas:v1"; // nombre antiguo, se sigue leyendo
  const STRIKE_DELAY = 380;
  const LEAVE_DURATION = 320;

  const form = document.getElementById("add-form");
  const input = document.getElementById("task-input");
  const list = document.getElementById("task-list");
  const emptyEl = document.getElementById("empty");

  function loadTasks() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");
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
    const item = document.createElement("li");
    item.className = "task" + (animate ? " entering" : "");
    item.dataset.id = task.id;

    const row = document.createElement("div");
    row.className = "task-row";

    const content = document.createElement("div");
    content.className = "task-content";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "check";
    checkbox.setAttribute("aria-label", `Completar tarea: ${task.name}`);

    const name = document.createElement("span");
    name.className = "task-name";
    name.textContent = task.name;

    content.append(checkbox, name);
    row.append(content);
    item.append(row);
    return item;
  }

  function completeTask(item) {
    if (item.classList.contains("done")) return;
    item.classList.add("done");

    tasks = tasks.filter((t) => t.id !== item.dataset.id);
    saveTasks();

    setTimeout(() => {
      item.classList.add("leaving");
      setTimeout(() => {
        item.remove();
        updateEmpty();
      }, LEAVE_DURATION);
    }, STRIKE_DELAY);
  }

  list.addEventListener("change", (event) => {
    const checkbox = event.target;
    if (!checkbox.classList.contains("check") || !checkbox.checked) return;
    completeTask(checkbox.closest(".task"));
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
     Navegación entre los dos estados: inicio (home) y tareas (tasks)
     ------------------------------------------------------------------------ */
  const tasksSection = document.getElementById("tasks");
  const scrollHint = document.querySelector(".scroll-hint");
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

  let lastWheelTime = 0;
  let wheelStartedAtTop = false;

  window.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) return;

      const now = performance.now();
      if (now - lastWheelTime > 200) wheelStartedAtTop = atTasksTop();
      lastWheelTime = now;

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
      const swipe = touchStartY - event.touches[0].clientY; // > 0: deslizar hacia arriba

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

    const isDownKey = ["ArrowDown", "PageDown", "End"].includes(event.key) || (event.key === " " && onPage);
    const isUpKey = ["ArrowUp", "PageUp", "Home"].includes(event.key);

    if (isDownKey && inHome()) {
      event.preventDefault();
      goDown();
    } else if (isUpKey && window.scrollY > 0 && (atTasksTop() || inHome())) {
      event.preventDefault();
      goUp();
    }
  });

  scrollHint.addEventListener("click", (event) => {
    event.preventDefault();
    goDown();
  });

  // El título "Tareas" aparece al pasar de la mitad del recorrido hacia las tareas.
  const updateOpen = () => tasksSection.classList.toggle("open", window.scrollY > tasksTop() * 0.5);
  window.addEventListener("scroll", updateOpen, { passive: true });
  window.addEventListener("resize", updateOpen);
  updateOpen();

  /* ------------------------------------------------------------------------
     Inicio
     ------------------------------------------------------------------------ */
  tasks.forEach((task) => list.append(createTaskElement(task, false)));
  updateEmpty();
  tick();
  requestPlace();
  fetchWeather(place);
  setInterval(() => fetchWeather(activePlace()), 15 * 60 * 1000);

  // Las transiciones de color se activan tras el primer pintado para evitar un parpadeo inicial.
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add("ready")));

  // Pruebas desde la consola del navegador: testSky("help")
  window.testSky = testSky;
})();