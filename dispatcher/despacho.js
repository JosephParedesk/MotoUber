// ============================================================
// dispatcher/despacho.js — Evolution API version
// ============================================================
'use strict';

let enviar; // función enviar(numero, msg) inyectada desde index.js
let db;

const init = (enviarFn, dbConnection) => {
  enviar = enviarFn;
  db     = dbConnection;
};

// ── Crear servicio ────────────────────────────────────────────

const crearServicio = async (clienteWhatsapp, ubicacionTexto = null, lat = null, lng = null) => {
  const [result] = await db.execute(
    `INSERT INTO servicios (cliente_whatsapp, ubicacion_texto, ubicacion_lat, ubicacion_lng, estado)
     VALUES (?, ?, ?, ?, 'pendiente')`,
    [clienteWhatsapp, ubicacionTexto, lat, lng]
  );
  return result.insertId;
};

// ── Despachar servicio ────────────────────────────────────────

const despacharServicio = async (servicioId, clienteWhatsapp, ubicacion) => {
  const [conductores] = await db.execute(
    `SELECT whatsapp_no, nombre FROM conductores WHERE estado = 'online' AND activo = 1`
  );

  if (conductores.length === 0) {
    const cs = require('../conductor_state/conductor_state');
    await enviar(clienteWhatsapp, cs.clienteSinConductores());
    return { despachado: false };
  }

  const cs = require('../conductor_state/conductor_state');
  const promesas = conductores.map(async (conductor) => {
    try {
      await enviar(conductor.whatsapp_no, cs.nuevoServicio(ubicacion, null));
      await db.execute(
        `INSERT INTO servicio_notificaciones (servicio_id, conductor_whatsapp, estado)
         VALUES (?, ?, 'enviado') ON DUPLICATE KEY UPDATE estado = 'enviado', updated_at = NOW()`,
        [servicioId, conductor.whatsapp_no]
      );
      await db.execute(
        `UPDATE conductores SET estado_conv = 2 WHERE whatsapp_no = ?`,
        [conductor.whatsapp_no]
      );
    } catch (err) {
      console.error(`Error notificando conductor ${conductor.whatsapp_no}:`, err.message);
    }
  });

  await Promise.all(promesas);
  console.log(`✅ Servicio #${servicioId} despachado a ${conductores.length} conductor(es)`);
  return { despachado: true, conductoresNotificados: conductores.length };
};

// ── Manejar aceptación ────────────────────────────────────────

const manejarAceptacion = async (conductorWhatsapp, servicioId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT id, estado, cliente_whatsapp FROM servicios WHERE id = ? AND estado = 'pendiente' FOR UPDATE`,
      [servicioId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return { asignado: false };
    }

    const servicio = rows[0];

    await conn.execute(
      `UPDATE servicios SET conductor_whatsapp = ?, estado = 'asignado', hora_asignacion = NOW() WHERE id = ?`,
      [conductorWhatsapp, servicioId]
    );
    await conn.execute(`UPDATE conductores SET estado = 'ocupado' WHERE whatsapp_no = ?`, [conductorWhatsapp]);
    await conn.execute(
      `UPDATE servicio_notificaciones SET estado = 'aceptado' WHERE servicio_id = ? AND conductor_whatsapp = ?`,
      [servicioId, conductorWhatsapp]
    );
    await conn.execute(
      `UPDATE servicio_notificaciones SET estado = 'vencido'
       WHERE servicio_id = ? AND conductor_whatsapp != ? AND estado = 'enviado'`,
      [servicioId, conductorWhatsapp]
    );

    await conn.commit();

    // Notificar conductores que perdieron el servicio
    await notificarConductoresVencidos(servicioId, conductorWhatsapp);

    // Notificar al cliente con datos del conductor
    const [datosConductor] = await db.execute(
      `SELECT nombre, whatsapp_no, placa, modelo_moto, foto_url FROM conductores WHERE whatsapp_no = ?`,
      [conductorWhatsapp]
    );
    if (datosConductor.length > 0) {
      await notificarCliente(servicio.cliente_whatsapp, datosConductor[0]);
    }

    await db.execute(`UPDATE clientes SET estado_conv = 6 WHERE whatsapp_no = ?`, [servicio.cliente_whatsapp]);

    console.log(`✅ Servicio #${servicioId} asignado a ${conductorWhatsapp}`);
    return { asignado: true };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ── Manejar rechazo ───────────────────────────────────────────

const manejarRechazo = async (conductorWhatsapp, servicioId) => {
  await db.execute(
    `UPDATE servicio_notificaciones SET estado = 'rechazado'
     WHERE servicio_id = ? AND conductor_whatsapp = ?`,
    [servicioId, conductorWhatsapp]
  );

  const [pendientes] = await db.execute(
    `SELECT COUNT(*) as total FROM servicio_notificaciones WHERE servicio_id = ? AND estado = 'enviado'`,
    [servicioId]
  );

  if (pendientes[0].total === 0) {
    const cs = require('../conductor_state/conductor_state');
    const [servicio] = await db.execute(`SELECT cliente_whatsapp FROM servicios WHERE id = ?`, [servicioId]);
    if (servicio.length > 0) {
      await enviar(servicio[0].cliente_whatsapp, cs.clienteTodosRechazaron());
      await db.execute(`UPDATE servicios SET estado = 'cancelado' WHERE id = ?`, [servicioId]);
      await db.execute(`UPDATE clientes SET estado_conv = 2 WHERE whatsapp_no = ?`, [servicio[0].cliente_whatsapp]);
    }
  }
};

// ── Notificar conductores vencidos ────────────────────────────

const notificarConductoresVencidos = async (servicioId, conductorAsignado) => {
  const cs = require('../conductor_state/conductor_state');
  const [notificaciones] = await db.execute(
    `SELECT conductor_whatsapp FROM servicio_notificaciones
     WHERE servicio_id = ? AND conductor_whatsapp != ? AND estado = 'vencido'`,
    [servicioId, conductorAsignado]
  );
  await Promise.all(
    notificaciones.map(({ conductor_whatsapp }) =>
      enviar(conductor_whatsapp, cs.servicioYaTomado())
        .catch(err => console.error(`Error notificando vencido ${conductor_whatsapp}:`, err.message))
    )
  );
};

// ── Notificar cliente ─────────────────────────────────────────

const notificarCliente = async (clienteWhatsapp, conductor) => {
  const cs = require('../conductor_state/conductor_state');
  await enviar(clienteWhatsapp, cs.clienteNotificadoConductorAsignado(conductor));

  if (conductor.foto_url) {
    try {
      const wa = require('../whatsapp/evolution');
      await wa.sendImage(clienteWhatsapp, conductor.foto_url, `🏍️ ${conductor.modelo_moto} — ${conductor.placa}`);
    } catch (err) {
      console.error('Error enviando foto del vehículo:', err.message);
    }
  }
};

// ── Getters ───────────────────────────────────────────────────

const getServicioActivoConductor = async (conductorWhatsapp) => {
  const [rows] = await db.execute(
    `SELECT * FROM servicios WHERE conductor_whatsapp = ? AND estado IN ('asignado','en_punto','en_curso')
     ORDER BY id DESC LIMIT 1`,
    [conductorWhatsapp]
  );
  return rows[0] || null;
};

const getServicioActivoCliente = async (clienteWhatsapp) => {
  const [rows] = await db.execute(
    `SELECT s.*, c.nombre as conductor_nombre, c.placa, c.modelo_moto
     FROM servicios s LEFT JOIN conductores c ON s.conductor_whatsapp = c.whatsapp_no
     WHERE s.cliente_whatsapp = ? AND s.estado NOT IN ('completado','cancelado')
     ORDER BY s.id DESC LIMIT 1`,
    [clienteWhatsapp]
  );
  return rows[0] || null;
};

// ── Acciones de servicio ──────────────────────────────────────

const setETA = async (servicioId, etaMinutos) => {
  await db.execute(`UPDATE servicios SET eta_minutos = ? WHERE id = ?`, [etaMinutos, servicioId]);
};

const conductorEnPunto = async (servicioId, clienteWhatsapp) => {
  await db.execute(
    `UPDATE servicios SET estado = 'en_punto', hora_llegada_punto = NOW() WHERE id = ?`, [servicioId]
  );
  await enviar(clienteWhatsapp, '📍 *¡Tu conductor llegó al punto de recogida!*\nDirígete a la ubicación indicada. 🏃');
};

const finalizarServicio = async (servicioId, conductorWhatsapp, clienteWhatsapp) => {
  await db.execute(`UPDATE servicios SET estado = 'completado', hora_fin = NOW() WHERE id = ?`, [servicioId]);
  await db.execute(`UPDATE conductores SET estado = 'online' WHERE whatsapp_no = ?`, [conductorWhatsapp]);
  await db.execute(
    `UPDATE jornadas SET servicios_realizados = servicios_realizados + 1
     WHERE conductor_whatsapp = ? AND fin IS NULL`,
    [conductorWhatsapp]
  );
  await db.execute(`UPDATE clientes SET estado_conv = 2 WHERE whatsapp_no = ?`, [clienteWhatsapp]);
  await db.execute(`UPDATE conductores SET estado_conv = 1 WHERE whatsapp_no = ?`, [conductorWhatsapp]);

  const cs = require('../conductor_state/conductor_state');
  await enviar(clienteWhatsapp, cs.clienteServicioFinalizado());
  await enviar(conductorWhatsapp, '✅ *Servicio completado*\nYa quedas disponible para el próximo servicio. 💪');
};

const cancelarServicio = async (clienteWhatsapp) => {
  const [rows] = await db.execute(
    `SELECT id, conductor_whatsapp FROM servicios
     WHERE cliente_whatsapp = ? AND estado NOT IN ('completado','cancelado')
     ORDER BY id DESC LIMIT 1`,
    [clienteWhatsapp]
  );
  if (rows.length === 0) return { cancelado: false };

  const servicio = rows[0];
  await db.execute(`UPDATE servicios SET estado = 'cancelado' WHERE id = ?`, [servicio.id]);
  await db.execute(`UPDATE clientes SET estado_conv = 2 WHERE whatsapp_no = ?`, [clienteWhatsapp]);

  if (servicio.conductor_whatsapp) {
    await db.execute(`UPDATE conductores SET estado = 'online', estado_conv = 1 WHERE whatsapp_no = ?`, [servicio.conductor_whatsapp]);
    await enviar(servicio.conductor_whatsapp, '❌ *Servicio cancelado por el cliente.*\nYa quedas disponible para el próximo servicio.');
  } else {
    await db.execute(
      `UPDATE servicio_notificaciones SET estado = 'vencido' WHERE servicio_id = ? AND estado = 'enviado'`,
      [servicio.id]
    );
  }
  return { cancelado: true };
};

module.exports = {
  init, crearServicio, despacharServicio, manejarAceptacion, manejarRechazo,
  getServicioActivoConductor, getServicioActivoCliente,
  setETA, conductorEnPunto, finalizarServicio, cancelarServicio,
};
