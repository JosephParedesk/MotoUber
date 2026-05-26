// ============================================================
// cliente_state/cliente_state.js
// Mensajes del flujo cliente — sin dependencia de whatsapp-web.js
// ============================================================
'use strict';

const texto   = (text)                         => ({ type: 'text', text });
const botones = (text, title, footer, buttons) => ({ type: 'buttons', text, title, footer, buttons });

// ── Estado 0: nuevo usuario ──────────────────────────────────

const bienvenidaNuevo = () =>
  texto(`👋 Bienvenido a *Moto Central*.\n\nSomos tu servicio de motos por WhatsApp.\nPara comenzar, ¿cuál es tu nombre?`);

// ── Estado 1: esperando nombre ───────────────────────────────

const nombreInvalido = () =>
  texto(`⚠️ Ese nombre no es válido. Por favor escribe solo letras (sin números ni símbolos).`);

// ── Estado 2: menú principal ─────────────────────────────────

const menuPrincipal = (nombre) => botones(
  `Hola *${nombre}* 👋\n\n¿Cómo quieres indicar dónde estás?`,
  'Moto Central',
  'Selecciona una opción para pedir tu moto',
  [
    { id: BTN.PEDIR_TEXTO, text: '📝 Escribir dirección'  },
    { id: BTN.PEDIR_GPS,   text: '📍 Compartir ubicación' },
  ]
);

// ── Estado 3: esperando ubicación ────────────────────────────

const pedirUbicacionTexto = () =>
  texto(`📝 Escribe tu dirección o un punto de referencia claro:\n\n_Ejemplo: "Calle 5 # 10-23, frente al parque central"_`);

const pedirUbicacionGPS = () =>
  texto(`📍 Comparte tu ubicación desde WhatsApp:\n\n1. Toca el clip 📎 o el ícono +\n2. Selecciona *Ubicación*\n3. Toca *Enviar tu ubicación actual*\n\n_O escribe tu dirección si prefieres._`);

const ubicacionNoEntendida = () =>
  texto(`⚠️ No recibí tu ubicación.\n\nPuedes:\n• Escribir tu dirección en texto\n• Compartir tu ubicación GPS desde WhatsApp`);

// ── Estado 4: confirmar servicio ─────────────────────────────

const confirmarServicio = (ubicacion) => botones(
  `📋 *Resumen de tu pedido*\n\n📍 *Ubicación:*\n${ubicacion}\n\n¿Confirmamos el servicio?`,
  'Confirmar pedido',
  'Un conductor llegará lo antes posible',
  [
    { id: BTN.CONFIRMAR_SERVICIO, text: '✅ Confirmar' },
    { id: BTN.CANCELAR_SERVICIO,  text: '❌ Cancelar'  },
  ]
);

// ── Estado 5: esperando conductor ────────────────────────────

const buscandoConductor     = () => texto(`⏳ *Buscando conductor disponible...*\n\nTe notificaremos en cuanto uno acepte tu servicio.\n\nEscribe *cancelar* si deseas cancelar.`);
const recordatorioEsperando = () => texto(`⏳ Aún estamos buscando tu conductor...\n\nEscribe *cancelar* si deseas cancelar el servicio.`);

// ── Estado 6: servicio en curso ──────────────────────────────

const servicioEnCurso = (conductor) =>
  texto(`🛵 *Servicio en curso*\n\n👤 ${conductor.nombre || 'Tu conductor'} — ${conductor.placa || ''}\n\nEscribe *cancelar* si necesitas cancelar el servicio.`);

const servicioFinalizado = () =>
  texto(`✅ *¡Llegaste a tu destino!*\n\nGracias por usar *Moto Central*. 🙏\n\nEscribe *Hola* para pedir otra moto.`);

// ── Cancelación ───────────────────────────────────────────────

const confirmarCancelacion = () => botones(
  `¿Estás seguro de que quieres cancelar tu servicio?`,
  'Cancelar servicio',
  '',
  [
    { id: BTN.SI_CANCELAR, text: '✅ Sí, cancelar' },
    { id: BTN.NO_CANCELAR, text: '❌ No, mantener' },
  ]
);

const cancelacionConfirmada = () => texto(`❌ *Servicio cancelado.*\n\nEscribe *Hola* cuando quieras pedir otra moto.`);
const cancelacionAbortada   = () => texto(`✅ Servicio mantenido. ¡Tu conductor ya viene! 🛵`);
const nada_que_cancelar     = () => texto(`⚠️ No tienes un servicio activo para cancelar.`);

// ── Fallbacks ─────────────────────────────────────────────────

const errorGenerico = () => texto(`⚠️ Algo salió mal. Por favor escribe *Hola* para intentar de nuevo.`);

// ── IDs de botones ────────────────────────────────────────────

const BTN = {
  PEDIR_TEXTO       : 'pedir_ubicacion_texto',
  PEDIR_GPS         : 'pedir_ubicacion_gps',
  CONFIRMAR_SERVICIO: 'confirmar_servicio',
  CANCELAR_SERVICIO : 'cancelar_servicio',
  SI_CANCELAR       : 'si_cancelar',
  NO_CANCELAR       : 'no_cancelar',
};

module.exports = {
  bienvenidaNuevo, nombreInvalido, menuPrincipal,
  pedirUbicacionTexto, pedirUbicacionGPS, ubicacionNoEntendida,
  confirmarServicio, buscandoConductor, recordatorioEsperando,
  servicioEnCurso, servicioFinalizado,
  confirmarCancelacion, cancelacionConfirmada, cancelacionAbortada, nada_que_cancelar,
  errorGenerico,
  BTN,
};
