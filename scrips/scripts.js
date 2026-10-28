// ===== Configuración =====
const DEFAULT_PLACE = { name: 'Mazatlán', region: 'Sinaloa, México', lat: 23.2494, lon: -106.4111 };
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const STORAGE_KEY = 'clima-lugar';

// Códigos del clima (WMO) → [texto, ícono de día, ícono de noche]
// Los íconos son los <symbol id="i-..."> que están al inicio de index.html
const WEATHER = {
  0: ['Despejado', 'sun', 'moon'],
  1: ['Mayormente despejado', 'cloud-sun', 'cloud-moon'],
  2: ['Parcialmente nublado', 'cloud-sun', 'cloud-moon'],
  3: ['Nublado', 'cloud'],
  45: ['Niebla', 'fog'], 48: ['Niebla con escarcha', 'fog'],
  51: ['Llovizna ligera', 'drizzle'], 53: ['Llovizna', 'drizzle'], 55: ['Llovizna intensa', 'rain'],
  56: ['Llovizna helada', 'drizzle'], 57: ['Llovizna helada', 'rain'],
  61: ['Lluvia ligera', 'drizzle'], 63: ['Lluvia', 'rain'], 65: ['Lluvia intensa', 'rain'],
  66: ['Lluvia helada', 'rain'], 67: ['Lluvia helada', 'rain'],
  71: ['Nevada ligera', 'snow'], 73: ['Nevada', 'snow'], 75: ['Nevada intensa', 'snow'], 77: ['Granizo fino', 'snow'],
  80: ['Chubascos ligeros', 'drizzle'], 81: ['Chubascos', 'rain'], 82: ['Chubascos fuertes', 'storm'],
  85: ['Chubascos de nieve', 'snow'], 86: ['Chubascos de nieve', 'snow'],
  95: ['Tormenta', 'storm'], 96: ['Tormenta con granizo', 'storm'], 99: ['Tormenta con granizo', 'storm'],
};

// Qué cielo de fondo va con cada ícono (de noche siempre es 'night')
const SKY = {
  sun: 'clear', 'cloud-sun': 'clear', cloud: 'cloudy', fog: 'cloudy',
  drizzle: 'rain', rain: 'rain', snow: 'snow', storm: 'storm',
};

function describe(code, isDay = 1) {
  const [text, day, night] = WEATHER[code] || ['Sin datos', 'cloud'];
  return { text, icon: !isDay && night ? night : day };
}

// Crea <svg><use href="#i-sun"></use></svg>; si lleva texto, el lector de pantalla lo anuncia
function icon(name, label) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  svg.setAttribute('class', 'wx');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  return svg;
}

// ===== Elementos de la página =====
const $ = id => document.getElementById(id);
const weather = $('weather');
const message = $('message');
const results = $('results');
const cityInput = $('city');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContent no interpreta HTML: es seguro
  return node;
}

// ===== Pedir datos a la API =====
async function fetchJSON(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000); // si tarda más de 20 s, se cancela
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`el servidor respondió con error ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('la conexión tardó demasiado');
    if (err instanceof TypeError) throw new Error('parece que no hay conexión a internet');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ===== Mensajes y estado de carga =====
function showMessage(text, retry) {
  message.replaceChildren();
  message.hidden = !text;
  if (!text) return;
  message.append(el('span', '', text));
  if (retry) {
    const btn = el('button', 'btn btn-ghost', 'Reintentar');
    btn.type = 'button';
    btn.addEventListener('click', retry);
    message.append(btn);
  }
}

function setLoading(isLoading) {
  weather.classList.toggle('loading', isLoading);
  weather.setAttribute('aria-busy', isLoading);
}

// ===== Cargar y mostrar el clima =====
async function loadWeather(place) {
  setLoading(true);
  showMessage('');
  const params = new URLSearchParams({
    latitude: place.lat,
    longitude: place.lon,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
    hourly: 'temperature_2m,weather_code,is_day,precipitation_probability',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: 7,
  });
  try {
    const data = await fetchJSON(`${FORECAST_URL}?${params}`);
    renderCurrent(place, data.current);
    renderHourly(data.hourly, data.current.time);
    renderDaily(data.daily);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(place)); } catch (e) {}
  } catch (err) {
    showMessage(`No pude cargar el clima: ${err.message}.`, () => loadWeather(place));
  } finally {
    setLoading(false);
  }
}

function renderCurrent(place, now) {
  const { text, icon: name } = describe(now.weather_code, now.is_day);
  $('place').textContent = place.name;
  $('region').textContent = place.region;
  // La API manda la hora local de la ciudad, por ejemplo "2026-10-21T13:15"
  const date = new Date(now.time).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  $('date').textContent = `${date} · ${now.time.slice(11, 16)} h`;
  $('now-icon').replaceChildren(icon(name));
  $('now-temp').textContent = Math.round(now.temperature_2m);
  $('now-text').textContent = text;
  $('feels').textContent = `${Math.round(now.apparent_temperature)}°`;
  $('humidity').textContent = `${now.relative_humidity_2m}%`;
  $('wind').textContent = `${Math.round(now.wind_speed_10m)} km/h`;
  document.body.dataset.sky = now.is_day ? SKY[name] || 'clear' : 'night';
}

function renderHourly(hourly, nowTime) {
  // La lista empieza a medianoche: hay que saltar a la hora actual
  const start = Math.max(0, hourly.time.findIndex(t => t.slice(0, 13) === nowTime.slice(0, 13)));
  const items = hourly.time.slice(start, start + 24).map((time, i) => {
    const k = start + i;
    const { text, icon: name } = describe(hourly.weather_code[k], hourly.is_day[k]);
    const rain = hourly.precipitation_probability[k] ?? 0;
    const h = icon(name, text);
    h.classList.add('h-icon');
    const li = el('li');
    li.append(
      el('span', 'h-time', i === 0 ? 'Ahora' : time.slice(11, 16)),
      h,
      el('span', 'h-temp', `${Math.round(hourly.temperature_2m[k])}°`),
      // Solo se muestra si hay probabilidad real de lluvia, para no llenar de ceros
      el('span', 'h-rain', rain >= 20 ? `${rain}%` : ''),
    );
    return li;
  });
  $('hourly').replaceChildren(...items);
}

function renderDaily(daily) {
  const weekMin = Math.min(...daily.temperature_2m_min);
  const weekMax = Math.max(...daily.temperature_2m_max);
  const range = weekMax - weekMin || 1;
  const items = daily.time.map((date, i) => {
    const min = daily.temperature_2m_min[i];
    const max = daily.temperature_2m_max[i];
    const { text, icon: name } = describe(daily.weather_code[i]);
    const rain = daily.precipitation_probability_max[i] ?? 0;
    // Se usa el mediodía para que la zona horaria no cambie el día
    const day = i === 0 ? 'Hoy' : new Date(`${date}T12:00`).toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');
    const bar = el('span', 'd-bar');
    const fill = el('span');
    fill.style.setProperty('--from', `${((min - weekMin) / range) * 100}%`);
    fill.style.setProperty('--to', `${((max - weekMin) / range) * 100}%`);
    bar.append(fill);
    const d = icon(name, text);
    d.classList.add('d-icon');
    const drop = el('span', 'd-rain');
    if (rain >= 20) drop.append(icon('drop'), `${rain}%`);
    const li = el('li');
    li.append(
      el('span', 'd-day', day.charAt(0).toUpperCase() + day.slice(1)),
      d,
      drop,
      el('span', 'd-min', `${Math.round(min)}°`),
      bar,
      el('span', 'd-max', `${Math.round(max)}°`),
    );
    return li;
  });
  $('daily').replaceChildren(...items);
  $('now-range').textContent = `Máx. ${Math.round(daily.temperature_2m_max[0])}° · Mín. ${Math.round(daily.temperature_2m_min[0])}°`;
}

// ===== Buscar ciudades =====
$('search').addEventListener('submit', async e => {
  e.preventDefault();
  const query = cityInput.value.trim();
  if (!query) return;
  try {
    const params = new URLSearchParams({ name: query, count: 5, language: 'es' });
    const data = await fetchJSON(`${GEO_URL}?${params}`);
    const places = (data.results || []).map(r => ({
      name: r.name,
      region: [r.admin1, r.country].filter(Boolean).join(', '),
      lat: r.latitude,
      lon: r.longitude,
    }));
    if (!places.length) {
      showMessage(`No encontré "${query}". Revisa cómo está escrito.`);
      return;
    }
    if (places.length === 1) choosePlace(places[0]);
    else showResults(places);
  } catch (err) {
    showMessage(`No pude buscar la ciudad: ${err.message}.`);
  }
});

// Si hay varias ciudades con el mismo nombre, se deja elegir
function showResults(places) {
  results.replaceChildren(...places.map(place => {
    const btn = el('button', '', place.name);
    btn.type = 'button';
    btn.append(el('small', '', place.region));
    btn.addEventListener('click', () => choosePlace(place));
    const li = el('li');
    li.append(btn);
    return li;
  }));
  results.hidden = false;
  showMessage('');
  results.querySelector('button').focus();
}

function choosePlace(place) {
  results.hidden = true;
  cityInput.value = '';
  loadWeather(place);
}

// ===== Usar la ubicación del dispositivo =====
$('locate').addEventListener('click', () => {
  if (!('geolocation' in navigator)) {
    showMessage('Tu navegador no permite obtener la ubicación.');
    return;
  }
  showMessage('Buscando tu ubicación…');
  navigator.geolocation.getCurrentPosition(
    pos => choosePlace({
      name: 'Mi ubicación',
      region: `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`,
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
    }),
    err => showMessage(err.code === err.PERMISSION_DENIED
      ? 'No diste permiso para usar tu ubicación.'
      : 'No pude obtener tu ubicación.'),
    { timeout: 10000 },
  );
});

// ===== Inicio: el último lugar consultado o Mazatlán =====
let startPlace = DEFAULT_PLACE;
try { startPlace = JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_PLACE; } catch (e) {}
loadWeather(startPlace);

// ===== Modo claro / oscuro =====
$('theme-btn').addEventListener('click', () => {
  const root = document.documentElement;
  const isDark = root.dataset.theme
    ? root.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = isDark ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
});
