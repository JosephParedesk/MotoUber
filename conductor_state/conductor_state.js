// ============================================================
// conductor_state/conductor_state.js
// Mensajes del flujo conductor — texto plano sin botones ni listas
// ============================================================
'use strict';

const texto = (text) => ({ type: 'text', text });

// ── Estado 0: offline ────────────────────────────────────────

const bienvenida = (nombre) =>
  texto(`👋 Hola *${nombre}*.\n\nEstás *fuera de línea*.\n\nResponde *1* para iniciar tu jornada.`);

// ── Estado 1: online disponible ──────────────────────────────

const enLinea = (nombre, serviciosHoy = 0) =>
  texto(`🟢 *${nombre}*, estás en línea.\n\n📊 Servicios hoy: *${serviciosHoy}*\n\nRecibirás una notificación cuando haya un servicio disponible.\n\nResponde *0* para finalizar tu jornada.`);

// ── Estado 2: notificado de servicio ─────────────────────────

const nuevoServicio = (ubicacion, clienteNombre = null) =>
  texto(`🛵 *¡Nuevo servicio disponible!*\n\n👤 Cliente: ${clienteNombre || 'Cliente'}\n📍 Ubicación:\n${ubicacion}\n\n⚡ Responde rápido antes que otro conductor lo tome.\n\n1️⃣ Aceptar\n2️⃣ Rechazar`);

const servicioYaTomado = () =>
  texto('⚠️ *Servicio ya tomado.*\nOtro conductor aceptó primero. Sigues disponible para el próximo. 💪');

const servicioRechazado = () =>
  texto('❌ Servicio rechazado.\nSigues en línea para el próximo servicio.');

// ── Estado 3: aceptado, pedir ETA ────────────────────────────

const servicioAceptado = (ubicacion) =>
  texto(`✅ *¡Servicio aceptado!*\n\n📍 Dirígete a:\n*${ubicacion}*\n\nEl cliente ya fue notificado.`);

const pedirETA = () =>
  texto(`¿En cuántos minutos calculas que llegas al punto de recogida?\n\n1️⃣ 3 minutos\n2️⃣ 5 minutos\n3️⃣ 10 minutos\n4️⃣ 15 minutos\n5️⃣ 20 minutos\n6️⃣ 30 minutos\n\nResponde con el número.`);

const ETAconfirmado = (minutos) =>
  texto(`⏱️ ETA confirmado: *${minutos} minutos*.\nEl cliente ya fue notificado. Dirígete al punto de recogida.`);

// ── Estado 4: en camino ──────────────────────────────────────

const enCamino = (ubicacion, minutos) =>
  texto(`🏍️ *En camino al cliente*\n\n📍 ${ubicacion}\n⏱️ ETA informado: ${minutos} min\n\nResponde *1* cuando llegues al punto de recogida.`);

// ── Estado 5: en punto de recogida ───────────────────────────

const enPunto = (clienteNombre) =>
  texto(`📍 *Llegaste al punto de recogida*\n\nEl cliente *${clienteNombre || 'el cliente'}* ya fue notificado de tu llegada.\n\nResponde *1* cuando lleguen al destino para finalizar el servicio.`);

// ── Mensajes para el cliente ──────────────────────────────────

const clienteNotificadoConductorAsignado = (conductor) =>
  texto(
    `✅ *¡Tu moto ya viene en camino!*\n\n` +
    `👤 *Conductor:* ${conductor.nombre}\n` +
    `🏍️ *Moto:* ${conductor.modelo_moto || 'No especificado'}\n` +
    `🔖 *Placa:* ${conductor.placa}\n` +
    `📱 *Contacto:* ${conductor.whatsapp_no}\n\n` +
    `_Te informaremos el tiempo estimado de llegada en un momento._`
  );

const clienteNotificadoETA      = (minutos) => texto(`⏱️ Tu conductor llegará en aproximadamente *${minutos} minutos*.`);
const clienteNotificadoLlegada  = ()        => texto(`📍 *¡Tu conductor llegó!*\n\nDirígete al punto de recogida. 🏃\n\nBuen viaje 🛵`);
const clienteServicioFinalizado = ()        => texto(`✅ *Servicio finalizado*\n\n¡Gracias por usar *Moto Central*! 🙏\n\nEscribe *Hola* para pedir otra moto.`);
const clienteSinConductores     = ()        => texto(`😔 En este momento no hay conductores disponibles.\n\nTu solicitud quedó registrada. Te avisamos en cuanto haya uno libre.\n\nO escribe *Hola* para intentar de nuevo.`);
const clienteTodosRechazaron    = ()        => texto(`😔 Ningún conductor pudo tomar tu servicio en este momento.\n\nIntenta de nuevo en unos minutos.\nEscribe *Hola* para pedir otra moto.`);

// ── Fallbacks ─────────────────────────────────────────────────

const errorGenerico = () => texto('⚠️ Ocurrió un error inesperado. Por favor intenta de nuevo o escribe *Hola* para reiniciar.');
const noEntendido   = () => texto('🤔 No entendí ese mensaje. Escribe *Hola* para ver las opciones.');

// ── IDs (se mantienen para compatibilidad con index.js) ───────

const BTN = {
  INICIAR_JORNADA   : 'iniciar_jornada',
  FINALIZAR_JORNADA : 'finalizar_jornada',
  ACEPTAR_SERVICIO  : 'aceptar_servicio',
  RECHAZAR_SERVICIO : 'rechazar_servicio',
  LLEGUE_PUNTO      : 'llegue_punto',
  FINALIZAR_SERVICIO: 'finalizar_servicio',
};

const ETA_ROW_IDS = ['eta_3', 'eta_5', 'eta_10', 'eta_15', 'eta_20', 'eta_30'];

module.exports = {
  bienvenida, enLinea, nuevoServicio, servicioYaTomado, servicioRechazado,
  servicioAceptado, pedirETA, ETAconfirmado, enCamino, enPunto,
  clienteNotificadoConductorAsignado, clienteNotificadoETA,
  clienteNotificadoLlegada, clienteServicioFinalizado,
  clienteSinConductores, clienteTodosRechazaron,
  errorGenerico, noEntendido,
  BTN, ETA_ROW_IDS,
};