// ============================================================
// admin_state/admin_state.js
// Panel de administración vía WhatsApp
// ============================================================
'use strict';

let db;
let enviar;
let conductorOrm;
let servicioOrm;

const sesionesRegistro = {};

const init = (enviarFn, dbConnection) => {
  enviar       = enviarFn;
  db           = dbConnection;
  conductorOrm = require('../ORM/conductor/conductor_orm');
  servicioOrm  = require('../ORM/servicio/servicio_orm');
  conductorOrm.setConnection(dbConnection);
  servicioOrm.setConnection(dbConnection);
};

const iconoEstado = (estado) =>
  ({ online: '🟢', ocupado: '🔴', offline: '⚫' })[estado] ?? '❓';

// ── Menú ──────────────────────────────────────────────────────

const menuPrincipal = () =>
  `🔧 *Panel Admin — Moto Central*\n\n` +
  `*Consultas:*\n` +
  `• *menu* → ver esta lista\n` +
  `• *conductores* → estado de todos los conductores\n` +
  `• *servicios* → servicios activos ahora\n` +
  `• *stats* → resumen del día\n\n` +
  `*Gestión de conductores:*\n` +
  `• *agregar conductor* → registrar conductor nuevo\n` +
  `• *activar +57XXXXXXXXXX* → activar conductor\n` +
  `• *desactivar +57XXXXXXXXXX* → desactivar conductor\n\n` +
  `*Servicios:*\n` +
  `• *cancelar #5* → cancelar servicio por ID`;

// ── Conductores ───────────────────────────────────────────────

const listarConductores = async () => {
  const rows = await conductorOrm.todos();
  if (rows.length === 0) return '⚠️ No hay conductores registrados.\n\nEscribe *agregar conductor* para añadir uno.';

  let texto = `🏍️ *Conductores (${rows.length})*\n${'─'.repeat(25)}\n\n`;
  for (const c of rows) {
    const icono  = c.activo ? iconoEstado(c.estado) : '🚫';
    const estado = c.activo ? c.estado.toUpperCase() : 'DESACTIVADO';
    texto +=
      `${icono} *${c.nombre}*\n` +
      `   📱 ${c.whatsapp_no}\n` +
      `   🏍️ ${c.modelo_moto || 'Sin modelo'} — *${c.placa}*\n` +
      `   Estado: ${estado}\n\n`;
  }
  return texto.trim();
};

// ── Servicios activos ─────────────────────────────────────────

const listarServiciosActivos = async () => {
  const [rows] = await db.execute(
    `SELECT s.id, s.estado, s.ubicacion_texto, s.eta_minutos,
            s.created_at, cl.nombre AS cliente, co.nombre AS conductor, co.placa
     FROM servicios s
     LEFT JOIN clientes    cl ON s.cliente_whatsapp   = cl.whatsapp_no
     LEFT JOIN conductores co ON s.conductor_whatsapp = co.whatsapp_no
     WHERE s.estado NOT IN ('completado','cancelado')
     ORDER BY s.id DESC LIMIT 20`
  );

  if (rows.length === 0) return '✅ No hay servicios activos en este momento.';

  const iconoServicio = { pendiente: '⏳', asignado: '🛵', en_punto: '📍', en_curso: '🏃' };
  let texto = `📋 *Servicios activos (${rows.length})*\n${'─'.repeat(25)}\n\n`;
  for (const s of rows) {
    const icono    = iconoServicio[s.estado] ?? '❓';
    const minutos  = Math.floor((Date.now() - new Date(s.created_at)) / 60000);
    const conductor = s.conductor ? `🏍️ ${s.conductor} (${s.placa})` : '🔍 Sin conductor aún';
    texto +=
      `${icono} *#${s.id}* — ${s.estado.toUpperCase()}\n` +
      `   👤 ${s.cliente || 'Cliente'}\n` +
      `   📍 ${s.ubicacion_texto || 'GPS'}\n` +
      `   ${conductor}\n` +
      `   ⏱️ Hace ${minutos} min\n\n`;
  }
  texto += `_Usa *cancelar #ID* para cancelar uno específico_`;
  return texto.trim();
};

// ── Stats ─────────────────────────────────────────────────────

const statsHoy = async () => {
  const resumen  = await servicioOrm.resumenHoy();
  const online   = await conductorOrm.online();
  const ocupados = await conductorOrm.ocupados();
  const prom     = resumen.promedio_minutos ? `${Math.round(resumen.promedio_minutos)} min` : 'N/A';

  return (
    `📊 *Resumen de hoy*\n${'─'.repeat(25)}\n\n` +
    `*Servicios:*\n` +
    `   ✅ Completados : ${resumen.completados ?? 0}\n` +
    `   ❌ Cancelados  : ${resumen.cancelados  ?? 0}\n` +
    `   ⏳ Activos     : ${resumen.activos     ?? 0}\n` +
    `   📦 Total       : ${resumen.total       ?? 0}\n` +
    `   ⏱️ Tiempo prom : ${prom}\n\n` +
    `*Conductores ahora:*\n` +
    `   🟢 En línea    : ${online.length}\n` +
    `   🔴 Ocupados    : ${ocupados.length}\n`
  );
};

// ── Cancelar servicio ─────────────────────────────────────────

const cancelarServicio = async (adminWhatsapp, servicioId) => {
  const despacho = require('../dispatcher/despacho');
  const servicio = await servicioOrm.porId(servicioId);
  if (!servicio) return `⚠️ No existe el servicio *#${servicioId}*.`;
  if (['completado', 'cancelado'].includes(servicio.estado)) {
    return `⚠️ El servicio *#${servicioId}* ya está *${servicio.estado}*.`;
  }
  if (servicio.cliente_whatsapp) {
    await despacho.cancelarServicio(servicio.cliente_whatsapp);
  } else {
    await servicioOrm.cancelar(servicioId);
  }
  return `✅ Servicio *#${servicioId}* cancelado correctamente.`;
};

// ── Activar / desactivar ──────────────────────────────────────

const activarConductor = async (numero) => {
  const conductor = await conductorOrm.existe(numero);
  if (!conductor) return `⚠️ No encontré ningún conductor con el número *${numero}*.`;
  await conductorOrm.activar(numero);
  return `✅ Conductor *${conductor.nombre}* activado.`;
};

const desactivarConductor = async (numero) => {
  const conductor = await conductorOrm.existe(numero);
  if (!conductor) return `⚠️ No encontré ningún conductor con el número *${numero}*.`;
  await conductorOrm.desactivar(numero);
  return `🚫 Conductor *${conductor.nombre}* desactivado.`;
};

// ── Registro de conductor paso a paso ────────────────────────

const PASOS = {
  1: { campo: 'whatsapp_no', pregunta: '📱 ¿Cuál es el número WhatsApp del conductor?\n_Formato: +573001234567_' },
  2: { campo: 'nombre',      pregunta: '👤 ¿Cuál es el nombre completo del conductor?' },
  3: { campo: 'placa',       pregunta: '🔖 ¿Cuál es la placa de la moto?\n_Ejemplo: ABC123_' },
  4: { campo: 'modelo_moto', pregunta: '🏍️ ¿Cuál es el modelo de la moto?\n_Ejemplo: Honda CB 125F 2023_' },
};

const iniciarRegistro = (adminWhatsapp) => {
  sesionesRegistro[adminWhatsapp] = { paso: 1, datos: {} };
  return (
    `➕ *Registrar nuevo conductor*\n\n` +
    `Responde las siguientes preguntas.\n` +
    `Escribe *cancelar registro* en cualquier momento para abortar.\n\n` +
    PASOS[1].pregunta
  );
};

const enRegistro = (adminWhatsapp) => !!sesionesRegistro[adminWhatsapp];

const procesarRegistro = async (adminWhatsapp, respuesta) => {
  if (respuesta.toLowerCase() === 'cancelar registro') {
    delete sesionesRegistro[adminWhatsapp];
    return '❌ Registro cancelado.';
  }

  const sesion = sesionesRegistro[adminWhatsapp];
  const { paso, datos } = sesion;

  // ── Paso 5: confirmación (verificar ANTES de tocar PASOS[paso]) ──
  if (paso === 5) {
    const respLower = respuesta.toLowerCase().trim();

    if (respLower === 'si' || respLower === 'sí') {
      try {
        await conductorOrm.registrar({
          whatsapp : datos.whatsapp_no,
          nombre   : datos.nombre,
          placa    : datos.placa.toUpperCase(),
          modelo   : datos.modelo_moto,
          foto     : null,
        });
        delete sesionesRegistro[adminWhatsapp];

        // Enviar bienvenida al conductor
        try {
          await enviar(
            datos.whatsapp_no,
            `👋 Hola *${datos.nombre}*!\n\nFuiste registrado en *Moto Central*.\nEscribe *Hola* para iniciar tu jornada.`
          );
        } catch (e) {
          console.error('No se pudo enviar bienvenida:', e.message);
        }

        return (
          `✅ *Conductor registrado exitosamente*\n\n` +
          `👤 ${datos.nombre} — ${datos.placa.toUpperCase()}\n` +
          `📱 ${datos.whatsapp_no}\n\n` +
          `Se le envió un mensaje de bienvenida.`
        );
      } catch (err) {
        delete sesionesRegistro[adminWhatsapp];
        if (err.code === 'ER_DUP_ENTRY') {
          return '⚠️ Ya existe un conductor con esa placa o número. Registro cancelado.';
        }
        throw err;
      }
    }

    if (respLower === 'no') {
      delete sesionesRegistro[adminWhatsapp];
      return '❌ Registro cancelado. Escribe *agregar conductor* para intentar de nuevo.';
    }

    return 'Responde *si* para confirmar o *no* para cancelar.';
  }

  // ── Validaciones ──────────────────────────────────────────
  if (paso === 1) {
    if (!/^\+\d{10,15}$/.test(respuesta.trim())) {
      return '⚠️ Número inválido. Debe incluir el código de país.\n_Ejemplo: +573001234567_';
    }
    const yaExiste = await conductorOrm.existe(respuesta.trim());
    if (yaExiste) {
      return `⚠️ Ya existe un conductor con el número *${respuesta.trim()}*.\n\nEscribe *cancelar registro* para salir.`;
    }
  }

  if (paso === 3) {
    if (!/^[A-Za-z]{3}\d{2,3}[A-Za-z0-9]?$/.test(respuesta.trim())) {
      return '⚠️ Formato de placa inválido.\n_Ejemplo válido: ABC123_';
    }
  }

  // ── Guardar y avanzar ─────────────────────────────────────
  datos[PASOS[paso].campo] = respuesta.trim();

  if (paso < 4) {
    sesion.paso = paso + 1;
    return PASOS[paso + 1].pregunta;
  }

  // Paso 4 completado → mostrar confirmación
  sesion.paso = 5;
  return (
    `📋 *Confirmar nuevo conductor:*\n\n` +
    `📱 WhatsApp : ${datos.whatsapp_no}\n` +
    `👤 Nombre   : ${datos.nombre}\n` +
    `🔖 Placa    : ${datos.placa.toUpperCase()}\n` +
    `🏍️ Modelo   : ${datos.modelo_moto}\n\n` +
    `¿Confirmar registro?\n` +
    `*si* → guardar\n` +
    `*no* → cancelar`
  );
};

// ── Manejador principal ───────────────────────────────────────

const manejar = async (msg, adminWhatsapp, cuerpo, btnId, rowId) => {
  const lower = cuerpo.toLowerCase();
  let respuesta;

  try {
    if (enRegistro(adminWhatsapp)) {
      respuesta = await procesarRegistro(adminWhatsapp, cuerpo);
    } else if (['menu', 'hola', 'hi', 'hello', 'inicio', 'start'].includes(lower)) {
      respuesta = menuPrincipal();
    } else if (lower === 'conductores')       { respuesta = await listarConductores(); }
    else if (lower === 'servicios')           { respuesta = await listarServiciosActivos(); }
    else if (lower === 'stats')               { respuesta = await statsHoy(); }
    else if (lower === 'agregar conductor')   { respuesta = iniciarRegistro(adminWhatsapp); }
    else if (lower.startsWith('activar ')) {
      respuesta = await activarConductor(cuerpo.substring(8).trim());
    } else if (lower.startsWith('desactivar ')) {
      respuesta = await desactivarConductor(cuerpo.substring(11).trim());
    } else if (lower.startsWith('cancelar')) {
      const match = cuerpo.match(/#?(\d+)/);
      respuesta = match
        ? await cancelarServicio(adminWhatsapp, parseInt(match[1], 10))
        : '⚠️ Indica el ID del servicio. Ejemplo: *cancelar #5*';
    } else {
      respuesta = `🤔 Comando no reconocido.\n\nEscribe *menu* para ver los comandos disponibles.`;
    }
  } catch (err) {
    console.error(`❌ Error en admin (${adminWhatsapp}):`, err);
    respuesta = '⚠️ Ocurrió un error procesando tu comando. Revisa los logs.';
  }

  if (respuesta) await enviar(adminWhatsapp, respuesta);
};

module.exports = { init, manejar, enRegistro, menuPrincipal };