// ============================================================
// conductor_state/conductor_state.js
// Mensajes del flujo conductor — sin dependencia de whatsapp-web.js
// Retorna objetos { type, ... } que index.js convierte a llamadas
// al adaptador de Evolution API
// ============================================================
'use strict';

// ── Helpers de construcción ───────────────────────────────────

const texto   = (text)                         => ({ type: 'text', text });
const botones = (text, title, footer, buttons) => ({ type: 'buttons', text, title, footer, buttons });
const lista   = (text, title, footer, boton, rows) => ({ type: 'list', text, title, footer, boton, rows });

// ── Estado 0: offline ────────────────────────────────────────

const bienvenida = (nombre) => botones(
  `👋 Hola *${nombre}*.\n\nEstás *fuera de línea*. Inicia tu jornada cuando estés listo para recibir servicios.`,
  'Moto Central — Conductor',
  'Solo recibirás servicios con la jornada activa',
  [{ id: BTN.INICIAR_JORNADA, text: '🟢 Iniciar jornada' }]
);

// ── Estado 1: online disponible ──────────────────────────────

const enLinea = (nombre, serviciosHoy = 0) => botones(
  `🟢 *${nombre}*, estás en línea.\n\n📊 Servicios hoy: *${serviciosHoy}*\n\nRecibirás una notificación cuando haya un servicio disponible.`,
  'Jornada activa',
  'Disponible para nuevos servicios',
  [{ id: BTN.FINALIZAR_JORNADA, text: '🔴 Finalizar jornada' }]
);

// ── Estado 2: notificado de servicio ─────────────────────────

const nuevoServicio = (ubicacion, clienteNombre = null) => botones(
  `🛵 *¡Nuevo servicio disponible!*\n\n👤 Cliente: ${clienteNombre || 'Cliente'}\n📍 Ubicación:\n${ubicacion}\n\n⚡ Responde rápido antes que otro conductor lo tome.`,
  'Servicio disponible',
  'Primer conductor en aceptar se lo lleva',
  [
    { id: BTN.ACEPTAR_SERVICIO,  text: '✅ Aceptar'  },
    { id: BTN.RECHAZAR_SERVICIO, text: '❌ Rechazar' },
  ]
);

const servicioYaTomado = () =>
  texto('⚠️ *Servicio ya tomado.*\nOtro conductor aceptó primero. Sigues disponible para el próximo. 💪');

const servicioRechazado = () =>
  texto('❌ Servicio rechazado.\nSigues en línea para el próximo servicio.');

// ── Estado 3: aceptado, pedir ETA ────────────────────────────

const servicioAceptado = (ubicacion) =>
  texto(`✅ *¡Servicio aceptado!*\n\n📍 Dirígete a:\n*${ubicacion}*\n\nEl cliente ya fue notificado.`);

const pedirETA = () => lista(
  '¿En cuántos minutos calculas que llegas al punto de recogida?',
  'Tiempo estimado de llegada',
  'El cliente verá este tiempo estimado',
  '⏱️ Seleccionar tiempo',
  [
    { id: 'eta_3',  title: '3 minutos',  description: 'Estoy muy cerca'  },
    { id: 'eta_5',  title: '5 minutos',  description: 'A pocas cuadras'  },
    { id: 'eta_10', title: '10 minutos', description: 'En camino'         },
    { id: 'eta_15', title: '15 minutos', description: 'Tráfico moderado'  },
    { id: 'eta_20', title: '20 minutos', description: 'Un poco lejos'     },
    { id: 'eta_30', title: '30 minutos', description: 'Hay tráfico'       },
  ]
);

const ETAconfirmado = (minutos) =>
  texto(`⏱️ ETA confirmado: *${minutos} minutos*.\nEl cliente ya fue notificado. Dirígete al punto de recogida.`);

// ── Estado 4: en camino ──────────────────────────────────────

const enCamino = (ubicacion, minutos) => botones(
  `🏍️ *En camino al cliente*\n\n📍 ${ubicacion}\n⏱️ ETA informado: ${minutos} min\n\nPresiona el botón cuando llegues al punto de recogida.`,
  'En camino',
  'Avisa cuando estés en el punto',
  [{ id: BTN.LLEGUE_PUNTO, text: '📍 Llegué al punto' }]
);

// ── Estado 5: en punto de recogida ───────────────────────────

const enPunto = (clienteNombre) => botones(
  `📍 *Llegaste al punto de recogida*\n\nEl cliente *${clienteNombre || 'el cliente'}* ya fue notificado de tu llegada.\n\nFinaliza el servicio cuando lleguen al destino.`,
  'En punto de recogida',
  'Finaliza cuando lleguen al destino',
  [{ id: BTN.FINALIZAR_SERVICIO, text: '🏁 Finalizar servicio' }]
);

// ── Mensajes para el cliente (emitidos por eventos del conductor) ─

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
const noEntendido   = () => texto('🤔 No entendí ese mensaje. Usa los botones del menú o escribe *Hola* para ver las opciones.');

// ── IDs de botones ────────────────────────────────────────────

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
