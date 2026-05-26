// ============================================================
// whatsapp/evolution.js
// Adaptador de Evolution API — reemplaza whatsapp-web.js
// Todas las funciones de envío de mensajes pasan por aquí
// ============================================================
'use strict';

const fetch = (...args) =>
  import('node-fetch').then(({ default: f }) => f(...args));

const BASE_URL    = () => process.env.EVOLUTION_API_URL;
const INSTANCE    = () => process.env.EVOLUTION_INSTANCE;
const API_KEY     = () => process.env.EVOLUTION_API_KEY;

const headers = () => ({
  'Content-Type': 'application/json',
  apikey: API_KEY(),
});

// ── Normalizar número ─────────────────────────────────────────
// Acepta '+573001234567' o '573001234567@c.us' o '573001234567'
// y retorna '573001234567' (sin + ni @c.us ni @s.whatsapp.net)
const normalizeNumber = (numero) =>
  numero.replace(/^\+/, '').replace(/@.*$/, '').replace(/\D/g, '');

// ── Enviar texto plano ────────────────────────────────────────
const sendText = async (numero, texto) => {
  const number = normalizeNumber(numero);
  const res = await fetch(`${BASE_URL()}/message/sendText/${INSTANCE()}`, {
    method : 'POST',
    headers: headers(),
    body   : JSON.stringify({ number, text: texto }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ sendText error (${number}):`, err);
  }
};

// ── Enviar botones ────────────────────────────────────────────
// Evolution API soporta hasta 3 botones
// buttons: [{ id: 'btn_id', text: 'Texto botón' }]
const sendButtons = async (numero, titulo, descripcion, buttons, pie = '') => {
  const number = normalizeNumber(numero);
  const res = await fetch(`${BASE_URL()}/message/sendButtons/${INSTANCE()}`, {
    method : 'POST',
    headers: headers(),
    body   : JSON.stringify({
      number,
      title      : titulo,
      description: descripcion,
      footer     : pie,
      buttons    : buttons.map(b => ({
        type       : 'reply',
        displayText: b.text,
        id         : b.id,
      })),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ sendButtons error (${number}):`, err);
    // Fallback a texto si falla
    const opciones = buttons.map((b, i) => `${i + 1}. ${b.text}`).join('\n');
    await sendText(numero, `${titulo}\n${descripcion}\n\n${opciones}`);
  }
};

// ── Enviar lista ──────────────────────────────────────────────
// rows: [{ id: 'row_id', title: 'Título', description: 'Desc' }]
const sendList = async (numero, titulo, descripcion, boton, filas, pie = '') => {
  const number = normalizeNumber(numero);
  const res = await fetch(`${BASE_URL()}/message/sendList/${INSTANCE()}`, {
    method : 'POST',
    headers: headers(),
    body   : JSON.stringify({
      number,
      title      : titulo,
      description: descripcion,
      buttonText : boton,
      footer     : pie,
      sections   : [{ title: titulo, rows: filas }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ sendList error (${number}):`, err);
    // Fallback a texto
    const opciones = filas.map((r, i) => `${i + 1}. ${r.title}`).join('\n');
    await sendText(numero, `${titulo}\n${descripcion}\n\n${opciones}`);
  }
};

// ── Enviar imagen ─────────────────────────────────────────────
// imageUrl: URL pública de la imagen
const sendImage = async (numero, imageUrl, caption = '') => {
  const number = normalizeNumber(numero);
  const res = await fetch(`${BASE_URL()}/message/sendMedia/${INSTANCE()}`, {
    method : 'POST',
    headers: headers(),
    body   : JSON.stringify({
      number,
      mediatype: 'image',
      media    : imageUrl,
      caption,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ sendImage error (${number}):`, err);
  }
};

module.exports = {
  sendText,
  sendButtons,
  sendList,
  sendImage,
  normalizeNumber,
};
