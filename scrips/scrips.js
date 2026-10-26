// ==== Configuracion ====
const DEFAULT_PLACE = {name: 'Mazatlan', region: 'Sinaloa, Mexico', lat: 23.2494, lon: -106.4111 };
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const STORAGE_KEY = 'clima-lugar';

// Códigos del clima (WMO) → [texto, ícono de día, ícono de noche]
const WEATHER = {
  0: ['Despejado', '☀️', '🌙'],
  1: ['Mayormente despejado', '🌤️', '🌙'],
  2: ['Parcialmente nublado', '⛅', '☁️'],
  3: ['Nublado', '☁️'],
  45: ['Niebla', '🌫️'], 48: ['Niebla con escarcha', '🌫️'],
  51: ['Llovizna ligera', '🌦️'], 53: ['Llovizna', '🌦️'], 55: ['Llovizna intensa', '🌧️'],
  56: ['Llovizna helada', '🌧️'], 57: ['Llovizna helada', '🌧️'],
  61: ['Lluvia ligera', '🌦️'], 63: ['Lluvia', '🌧️'], 65: ['Lluvia intensa', '🌧️'],
  66: ['Lluvia helada', '🌧️'], 67: ['Lluvia helada', '🌧️'],
  71: ['Nevada ligera', '🌨️'], 73: ['Nevada', '🌨️'], 75: ['Nevada intensa', '❄️'], 77: ['Granizo fino', '🌨️'],
  80: ['Chubascos ligeros', '🌦️'], 81: ['Chubascos', '🌧️'], 82: ['Chubascos fuertes', '⛈️'],
  85: ['Chubascos de nieve', '🌨️'], 86: ['Chubascos de nieve', '❄️'],
  95: ['Tormenta', '⛈️'], 96: ['Tormenta con granizo', '⛈️'], 99: ['Tormenta con granizo', '⛈️'],
};

function describe(code, isDay = 1) {
    const [text, day, night] = WEATHER[code] || ['Sin datos', '❔'];
    return { text, icon:!isDay && night ? night : day}
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
    if ( text !== undefined) node.text.Content = text; // textContent no interpreta HTML
    return node;
}

// ===== Pedir datos a la API =====
async function fetchJSON(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000); // si tarda más de 10 s, se cancela
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