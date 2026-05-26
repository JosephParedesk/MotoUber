// ============================================================
// cliente_state/cliente_state.js
// Mensajes del flujo cliente — texto plano sin botones
// ============================================================
'use strict';

const texto = (text) => ({ type: 'text', text });

// ── Estado 0: nuevo usuario ──────────────────────────────────

const bienvenidaNuevo = () =>
  texto(`👋 Bienvenido a *Moto Central*.\n\nSomos tu servicio de motos por WhatsApp.\nPara comenzar, ¿cuál es tu nombre?`);

// ── Estado 1: esperando nombre ───────────────────────────────

const nombreInvalido = () =>
  texto(`⚠️ Ese nombre no es válido. Por favor escribe solo letras (sin números ni símbolos).`);

// ── Estado 2: menú principal ─────────────────────────────────

const menuPrincipal = (nombre) =>
  texto(`Hola *${nombre}* 👋\n\n¿Cómo quieres indicar dónde estás?\n\n1️⃣ Escribir dirección\n2️⃣ Compartir ubicación GPS\n\nResponde con *1* o *2*`);

// ── Estado 3: esperando barrio ────────────────────────────────

const pedirBarrio = () =>
  texto(`🏘️ ¿En qué *barrio* te encuentras?\n\n_Ejemplo: "Centro", "El Poblado", "La 14"_`);

const barrioInvalido = () =>
  texto(`⚠️ No entendí el barrio. Escribe solo el nombre del sector o barrio.`);

// ── Estado 4: esperando ubicación ────────────────────────────

const pedirUbicacionTexto = () =>
  texto(`📝 Escribe tu dirección o un punto de referencia claro:\n\n_Ejemplo: "Calle 5 # 10-23, frente al parque central"_`);

const pedirUbicacionGPS = () =>
  texto(`📍 Comparte tu ubicación desde WhatsApp:\n\n1. Toca el clip 📎 o el ícono +\n2. Selecciona *Ubicación*\n3. Toca *Enviar tu ubicación actual*\n\n_O escribe tu dirección si prefieres._`);

const ubicacionNoEntendida = () =>
  texto(`⚠️ No recibí tu ubicación.\n\nPuedes:\n• Escribir tu dirección en texto\n• Compartir tu ubicación GPS desde WhatsApp`);

// ── Estado 4: confirmar servicio ─────────────────────────────

const confirmarServicio = (ubicacion) =>
  texto(`📋 *Resumen de tu pedido*\n\n📍 *Ubicación:*\n${ubicacion}\n\n¿Confirmamos el servicio?\n\n1️⃣ Confirmar\n2️⃣ Cancelar\n\nResponde con *1* o *2*`);

// ── Estado 5: esperando conductor ────────────────────────────

const buscandoConductor     = () => texto(`⏳ *Buscando conductor disponible...*\n\nTe notificaremos en cuanto uno acepte tu servicio.\n\nEscribe *cancelar* si deseas cancelar.`);
const recordatorioEsperando = () => texto(`⏳ Aún estamos buscando tu conductor...\n\nEscribe *cancelar* si deseas cancelar el servicio.`);

// ── Estado 6: servicio en curso ──────────────────────────────

const servicioEnCurso = (conductor) =>
  texto(`🛵 *Servicio en curso*\n\n👤 ${conductor.nombre || 'Tu conductor'} — ${conductor.placa || ''}\n\nEscribe *cancelar* si necesitas cancelar el servicio.`);

const servicioFinalizado = () =>
  texto(`✅ *¡Llegaste a tu destino!*\n\nGracias por usar *Moto Central*. 🙏\n\nEscribe *Hola* para pedir otra moto.`);

// ── Cancelación ───────────────────────────────────────────────

const cancelacionConfirmada = () => texto(`❌ *Servicio cancelado.*\n\nEscribe *Hola* cuando quieras pedir otra moto.`);
const cancelacionAbortada   = () => texto(`✅ Servicio mantenido. ¡Tu conductor ya viene! 🛵`);
const nada_que_cancelar     = () => texto(`⚠️ No tienes un servicio activo para cancelar.`);

// ── Fallbacks ─────────────────────────────────────────────────

const errorGenerico = () => texto(`⚠️ Algo salió mal. Por favor escribe *Hola* para intentar de nuevo.`);

// ── IDs de botones (se mantienen para compatibilidad con index.js) ────

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
  pedirBarrio, barrioInvalido,
  pedirUbicacionTexto, pedirUbicacionGPS, ubicacionNoEntendida,
  confirmarServicio, buscandoConductor, recordatorioEsperando,
  servicioEnCurso, servicioFinalizado,
  cancelacionConfirmada, cancelacionAbortada, nada_que_cancelar,
  errorGenerico,
  BTN,
};