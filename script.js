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
  const PLACE_KEY = "ubicacion:v1";

  function loadPlace() {
    try {
      const p = JSON.parse(localStorage.getItem(PLACE_KEY) || "null");
      if (p && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180) return { lat: p.lat, lon: p.lon };
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
  let skyDirty = true; // fuerza recalcular el cielo (cambio de ubicación, fecha de prueba…)

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
     Un "tiempo" es { kind, intensity, clearness }:
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

  let test = null; // { until, offset, place, weather } mientras dura una prueba
  const activePlace = () => (test && test.place) || place;
  const activeWeather = () => (test && test.weather) || weatherCache[placeKey(activePlace())] || null;
  const currentDate = () => new Date(Date.now() + (test ? test.offset : 0));

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

  // --- Pruebas desde la consola: probarCielo({ tiempo, hora, lugar, intensidad, duracion }) ---
  const normalize = (str) => String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const TIEMPOS = {
    despejado: ["clear", 0, 1], soleado: ["clear", 0, 1], sol: ["clear", 0, 1], parcial: ["clear", 0, 0.35],
    nublado: ["cloudy", 0, 0], niebla: ["fog", 0.7, 0],
    llovizna: ["rain", 0.25, 0], lluvia: ["rain", 0.6, 0], aguacero: ["rain", 1, 0],
    nieve: ["snow", 0.6, 0], ventisca: ["snow", 1, 0], tormenta: ["storm", 0.8, 0],
  };

  const LUGARES = {
    igualada: { lat: 41.58, lon: 1.62 }, barcelona: { lat: 41.39, lon: 2.17 }, londres: { lat: 51.51, lon: -0.13 },
    "nueva york": { lat: 40.71, lon: -74.01 }, tokio: { lat: 35.68, lon: 139.69 }, sidney: { lat: -33.87, lon: 151.21 },
    quito: { lat: -0.18, lon: -78.47 }, reikiavik: { lat: 64.15, lon: -21.94 }, tromso: { lat: 69.65, lon: 18.96 },
    singapur: { lat: 1.35, lon: 103.82 }, "ciudad del cabo": { lat: -33.92, lon: 18.42 },
  };

  function parseHora(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
    if (m) {
      const d = new Date();
      d.setHours(+m[1], +m[2], 0, 0);
      return d.getTime();
    }
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? null : t;
  }

  function probarCielo(options) {
    if (options === undefined || options === null) {
      test = null;
      skyDirty = true;
      updateClock();
      console.info("Cielo: estado real.");
      return;
    }
    if (typeof options !== "object") {
      console.info(
        "probarCielo({ tiempo, hora, lugar, intensidad, duracion })\n" +
          `  tiempo:     ${Object.keys(TIEMPOS).join(", ")}\n` +
          '  hora:       "14:30" (hora del dispositivo), "2026-06-21T05:30" o "2026-06-21T05:30:00Z"\n' +
          `  lugar:      ${Object.keys(LUGARES).join(", ")} o { lat, lon }\n` +
          "  intensidad: 0 a 1 (lluvia, nieve, tormenta, niebla)\n" +
          "  duracion:   segundos (por defecto 60). Después vuelve al estado real.\n" +
          "  probarCielo() vuelve al estado real al instante."
      );
      return;
    }

    const { tiempo, hora, lugar, intensidad, duracion = 60 } = options;
    const next = { until: Date.now() + duracion * 1000, offset: 0, place: null, weather: null };

    if (hora !== undefined) {
      const t = parseHora(hora);
      if (t === null) console.warn("probarCielo: hora no válida.");
      else next.offset = t - Date.now();
    }
    if (lugar !== undefined) {
      const p = typeof lugar === "object" ? lugar : LUGARES[normalize(lugar)];
      if (p && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180) next.place = { lat: p.lat, lon: p.lon };
      else console.warn(`probarCielo: lugar no válido. Opciones: ${Object.keys(LUGARES).join(", ")} o { lat, lon }.`);
    }
    if (tiempo !== undefined) {
      const t = TIEMPOS[normalize(tiempo)];
      if (t) next.weather = { kind: t[0], intensity: clamp(intensidad ?? t[1], 0, 1), clearness: t[2] };
      else console.warn(`probarCielo: tiempo no válido. Opciones: ${Object.keys(TIEMPOS).join(", ")}.`);
    }

    test = next;
    skyDirty = true;
    if (next.place && !next.weather) fetchWeather(next.place); // el tiempo real de ese lugar
    updateClock();
    console.info(`Probando el cielo durante ${duracion} s; después vuelve al estado real.`);
  }

  /* ------------------------------------------------------------------------
     Posición del sol (fórmulas NOAA, todo en UTC)
     ------------------------------------------------------------------------ */
  const RAD = Math.PI / 180;
  const SUN_HORIZON = -0.833; // salida/puesta de sol (refracción + radio del disco)
  const TWILIGHT_END = -12; // por debajo de esta altura es noche cerrada

  function sunPosition(date, latDeg, lonDeg) {
    const lat = clamp(latDeg, -89.9, 89.9);
    const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    const y = date.getUTCFullYear();
    const dayOfYear = Math.floor((Date.UTC(y, date.getUTCMonth(), date.getUTCDate()) - Date.UTC(y, 0, 1)) / 86400000) + 1;
    const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (utcMin / 60 - 12) / 24);

    const eqtime =
      229.18 *
      (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    const decl =
      0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

    // Ángulo horario en grados: negativo antes del mediodía solar, positivo después.
    const trueSolarMin = (((utcMin + eqtime + 4 * lonDeg) % 1440) + 1440) % 1440;
    const hourAngle = trueSolarMin / 4 - 180;

    const latR = lat * RAD;
    const sinEl = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(hourAngle * RAD);
    const elevation = Math.asin(clamp(sinEl, -1, 1)) / RAD;

    // Mitad del arco diurno en grados (0 = noche polar, 180 = sol de medianoche).
    const cosH0 = (Math.cos(90.833 * RAD) - Math.sin(latR) * Math.sin(decl)) / (Math.cos(latR) * Math.cos(decl));
    const halfDay = Math.acos(clamp(cosH0, -1, 1)) / RAD;

    return { elevation, hourAngle, halfDay };
  }

  /* ------------------------------------------------------------------------
     Color: mezcla en OKLab (los tonos intermedios no se ven apagados)
     ------------------------------------------------------------------------ */
  const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

  function hexToLab(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    const n = parseInt(m ? m[1] : "808080", 16);
    const r = srgbToLinear(((n >> 16) & 255) / 255);
    const g = srgbToLinear(((n >> 8) & 255) / 255);
    const b = srgbToLinear((n & 255) / 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s,
    ];
  }

  function labToHex([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    return (
      "#" +
      rgb
        .map((c) => Math.round(clamp(linearToSrgb(clamp(c, 0, 1)), 0, 1) * 255).toString(16).padStart(2, "0"))
        .join("")
    );
  }

  const mixLab = (x, y, t) => x.map((v, i) => v + (y[i] - v) * t);

  // Las paletas viven en style.css (--sky-night, --sky-dawn…), en este orden:
  const TOKENS = ["bg", "surface", "ink", "muted", "line", "accent", "accentInk"];
  const palettes = {};

  function palette(name) {
    if (!palettes[name]) {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(`--sky-${name}`).trim().split(/\s+/);
      palettes[name] = Object.fromEntries(TOKENS.map((token, i) => [token, hexToLab(raw[i])]));
    }
    return palettes[name];
  }

  // Luminancia y contraste (WCAG) de un color en OKLab.
  function luminance([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const r = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, 0, 1);
    const g = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, 0, 1);
    const bl = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s, 0, 1);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  }

  function contrast(x, y) {
    const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Si el texto pasa de claro a oscuro entre dos paletas (o al revés), no se
  // mezcla: en cada instante se usa el extremo que mejor se lee sobre el fondo
  // actual, para no tener nunca un texto del mismo tono que el fondo.
  function mixText(x, y, t, keyA, keyB, keyNow, threshold) {
    if (t <= 0) return x;
    if (t >= 1) return y;
    const xLight = x[0] > 0.6;
    const yLight = y[0] > 0.6;
    if (xLight === yLight || keyA < threshold === keyB < threshold) return mixLab(x, y, t);
    return contrast(x, keyNow) >= contrast(y, keyNow) ? x : y;
  }

  function blend(a, b, t) {
    const out = {};
    for (const token of ["bg", "surface", "line", "accent"]) out[token] = mixLab(a[token], b[token], t);
    out.ink = mixText(a.ink, b.ink, t, a.bg[0], b.bg[0], out.bg, 0.6);
    out.muted = mixText(a.muted, b.muted, t, a.bg[0], b.bg[0], out.bg, 0.6);
    out.accentInk = mixText(a.accentInk, b.accentInk, t, a.accent[0], b.accent[0], out.accent, 0.65);
    return out;
  }

  /* ------------------------------------------------------------------------
     Cielo: saludo y colores según el sol
     De día, el color avanza con el porcentaje de luz solar transcurrido
     (0 = salida del sol, 1 = puesta). Entre la puesta/salida y la noche
     cerrada, avanza según la altura del sol bajo el horizonte.
     ------------------------------------------------------------------------ */
  const DAY_STOPS = [
    [0.0, "dawn"],
    [0.03, "dawn"],
    [0.18, "morning"],
    [0.4, "noon"],
    [0.5, "noon"],
    [0.64, "afternoon"],
    [0.74, "afternoon"],
    [0.94, "sunset"],
    [1.0, "sunset"],
  ];

  function dayColors(p) {
    for (let i = 0; i < DAY_STOPS.length - 1; i++) {
      const [p0, name0] = DAY_STOPS[i];
      const [p1, name1] = DAY_STOPS[i + 1];
      if (p <= p1) {
        const t = p1 > p0 ? smoothstep((p - p0) / (p1 - p0)) : 1;
        return blend(palette(name0), palette(name1), t);
      }
    }
    return palette("sunset");
  }

  // El tiempo mezcla la paleta del cielo con una paleta propia (solo de día).
  const WEATHER_PALETTE = { clear: "sunny", fog: "fog", rain: "rain", snow: "snow", storm: "storm" };

  function withWeather(colors, elevation) {
    const w = activeWeather();
    if (!w || !WEATHER_PALETTE[w.kind]) return colors;
    const day = smoothstep((elevation + 3) / 15);
    const k = w.intensity;
    const strength = {
      clear: 0.85 * w.clearness,
      fog: 0.6 + 0.2 * k,
      rain: 0.45 + 0.3 * k,
      snow: 0.6,
      storm: 0.7 + 0.25 * k,
    }[w.kind];
    return blend(colors, palette(WEATHER_PALETTE[w.kind]), strength * day);
  }

  function skyAt(date) {
    const p = activePlace();
    const { elevation, hourAngle, halfDay } = sunPosition(date, p.lat, p.lon);
    const morning = hourAngle < 0;

    if (elevation > SUN_HORIZON) {
      const f = halfDay > 0 ? clamp((hourAngle + halfDay) / (2 * halfDay), 0, 1) : morning ? 0 : 1;
      return { greeting: morning ? "Buenos días" : "Buenas tardes", colors: withWeather(dayColors(f), elevation) };
    }

    const u = smoothstep((elevation - TWILIGHT_END) / (SUN_HORIZON - TWILIGHT_END));
    const colors = morning
      ? blend(palette("night"), palette("dawn"), u)
      : blend(palette("night"), palette("sunset"), u);
    return { greeting: "Buenas noches", colors: withWeather(colors, elevation) };
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
     Se dibujan en un canvas detrás del contenido; no hay sol ni luna.
     Con "reducir movimiento" activado no se anima nada.
     ------------------------------------------------------------------------ */
  const fx = (() => {
    const canvas = document.createElement("canvas");
    canvas.className = "weather-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
    const ctx = canvas.getContext("2d");
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rand = (a, b) => a + Math.random() * (b - a);

    let W = 0, H = 0, weather = null, ink = "#000000", dark = false;
    let drops = [], flakes = [], blobs = [], bolt = null, nextBolt = 0, fade = 0, last = 0, raf = 0;

    function seed() {
      drops = []; flakes = []; blobs = [];
      if (!weather) return;
      const k = weather.intensity;
      const area = (W * H) / (1280 * 720);
      if (weather.kind === "rain" || weather.kind === "storm") {
        for (let i = 0; i < (80 + 420 * k) * area; i++) {
          const z = rand(0.5, 1);
          drops.push({ x: rand(-100, W), y: rand(0, H), len: rand(12, 26) * z, v: rand(750, 1100) * z * (0.8 + 0.4 * k) });
        }
      } else if (weather.kind === "snow") {
        for (let i = 0; i < (50 + 300 * k) * area; i++) {
          const z = rand(0.4, 1);
          flakes.push({ x: rand(0, W), y: rand(0, H), r: rand(1, 3.2) * z + 0.4, v: rand(35, 90) * z, ph: rand(0, 6.28), sw: rand(0.6, 1.6) });
        }
      } else if (weather.kind === "fog") {
        for (let i = 0; i < 7; i++) {
          blobs.push({ x: rand(0, W), y: rand(0.15 * H, H), r: rand(0.35, 0.7) * Math.max(W, H), v: rand(8, 22) * (i % 2 ? 1 : -1) });
        }
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function makeBolt(t0) {
      const main = [], branches = [];
      let x = rand(0.1, 0.9) * W, y = -10;
      main.push([x, y]);
      while (y < H) {
        y += rand(18, 38);
        x += rand(-26, 26);
        main.push([x, y]);
        if (Math.random() < 0.1) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          const br = [[x, y]];
          let bx = x, by = y;
          for (let i = 0, n = 3 + Math.floor(Math.random() * 5); i < n; i++) {
            by += rand(14, 28);
            bx += dir * rand(6, 24);
            br.push([bx, by]);
          }
          branches.push(br);
        }
      }
      return { t0, main, branches };
    }

    function strokePath(pts) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }

    function frame(t) {
      if (!weather) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min((t - last) / 1000 || 0, 0.05);
      last = t;
      fade = Math.min(1, fade + dt / 1.5);
      ctx.clearRect(0, 0, W, H);

      if (drops.length) {
        const wind = weather.kind === "storm" ? 0.28 : 0.12;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.2;
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.35 * fade;
        ctx.beginPath();
        for (const d of drops) {
          d.y += d.v * dt;
          d.x += d.v * wind * dt;
          if (d.y > H + 30) { d.y = -d.len; d.x = rand(-100, W); }
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
          f.y += f.v * dt;
          f.ph += dt * f.sw;
          if (f.y > H + 5) { f.y = -5; f.x = rand(0, W); }
          const x = f.x + Math.sin(f.ph) * 18;
          ctx.moveTo(x + f.r, f.y);
          ctx.arc(x, f.y, f.r, 0, 6.283);
        }
        ctx.fill();
      }

      if (blobs.length) {
        const rgb = dark ? "190,200,215" : "255,255,255";
        const a = (0.1 + 0.12 * weather.intensity) * fade;
        ctx.globalAlpha = 1;
        for (const b of blobs) {
          b.x += b.v * dt;
          if (b.v > 0 && b.x - b.r > W) b.x = -b.r;
          if (b.v < 0 && b.x + b.r < 0) b.x = W + b.r;
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
          g.addColorStop(0, `rgba(${rgb},${a})`);
          g.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
        }
      }

      if (weather.kind === "storm") {
        if (!bolt && t >= nextBolt) bolt = makeBolt(t);
        if (bolt) {
          const age = (t - bolt.t0) / 1000;
          // Destello doble y desvanecido (nunca parpadeo rápido continuo).
          const a = age < 0.08 ? 1 : age < 0.14 ? 0.25 : age < 0.24 ? 1 : Math.max(0, 1 - (age - 0.24) / 0.45);
          if (age > 0.7) {
            bolt = null;
            nextBolt = t + rand(2500, 9000) / (0.6 + weather.intensity);
          } else {
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.globalAlpha = 0.12 * a;
            ctx.fillStyle = "#dfe8ff";
            ctx.fillRect(0, 0, W, H);
            ctx.strokeStyle = "rgb(160,185,255)";
            ctx.globalAlpha = 0.35 * a;
            ctx.lineWidth = 7;
            strokePath(bolt.main);
            ctx.strokeStyle = "#f6f8ff";
            ctx.globalAlpha = a;
            ctx.lineWidth = 2;
            strokePath(bolt.main);
            ctx.lineWidth = 1;
            bolt.branches.forEach(strokePath);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function setWeather(w) {
      const next = w && ["rain", "snow", "storm", "fog"].includes(w.kind) && !prefersReduced.matches ? w : null;
      if ((next && next.kind) === (weather && weather.kind) && (next && next.intensity) === (weather && weather.intensity)) return;
      weather = next;
      fade = 0;
      bolt = null;
      nextBolt = performance.now() + rand(1500, 4000);
      seed();
      cancelAnimationFrame(raf);
      if (weather) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, W, H);
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
     Reloj y saludo
     ------------------------------------------------------------------------ */
  const hmEl = document.getElementById("time-hm");
  const sEl = document.getElementById("time-s");
  const greetingEl = document.getElementById("greeting");
  const dateEl = document.getElementById("date");

  let lastMinute = -1;

  function updateClock(testDate) {
    if (test && Date.now() >= test.until) {
      test = null; // la prueba terminó: vuelve el estado real
      skyDirty = true;
    }
    const now = testDate || currentDate();

    hmEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    sEl.textContent = `:${pad(now.getSeconds())}`;

    // "Miércoles, 4 de noviembre de 2026"
    const date = now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const dateText = date.charAt(0).toUpperCase() + date.slice(1);
    if (dateEl.textContent !== dateText) dateEl.textContent = dateText;

    // El cielo se recalcula cada minuto (o al cambiar la ubicación).
    const minute = Math.floor(now.getTime() / 60000);
    if (skyDirty || minute !== lastMinute) {
      lastMinute = minute;
      skyDirty = false;

      const sky = skyAt(now);
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

  // Pruebas desde la consola del navegador: probarCielo("ayuda")
  window.probarCielo = probarCielo;
})();