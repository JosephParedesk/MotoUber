// ============================================================
// ORM/servicio/servicio_orm.js
// CRUD de las tablas `servicios` y `servicio_notificaciones`
// Reemplaza a ORM/user/user_ride_orm.js
// ============================================================
'use strict';

let db;

const setConnection = (con) => { db = con; };

// ── Crear ────────────────────────────────────────────────────

const crear = async ({ clienteWhatsapp, ubicacionTexto, lat, lng }) => {
  const [result] = await db.execute(
    `INSERT INTO servicios
       (cliente_whatsapp, ubicacion_texto, ubicacion_lat, ubicacion_lng, estado)
     VALUES (?, ?, ?, ?, 'pendiente')`,
    [clienteWhatsapp, ubicacionTexto || null, lat || null, lng || null]
  );
  return result.insertId;
};

// ── Buscar ───────────────────────────────────────────────────

const porId = async (id) => {
  const [rows] = await db.execute(
    'SELECT * FROM servicios WHERE id = ? LIMIT 1', [id]
  );
  return rows[0] || null;
};

// Servicio activo de un cliente (no completado ni cancelado)
const activoCliente = async (clienteWhatsapp) => {
  const [rows] = await db.execute(
    `SELECT s.*,
            co.nombre       AS conductor_nombre,
            co.placa,
            co.modelo_moto,
            co.whatsapp_no  AS conductor_tel
     FROM servicios s
     LEFT JOIN conductores co ON s.conductor_whatsapp = co.whatsapp_no
     WHERE s.cliente_whatsapp = ?
       AND s.estado NOT IN ('completado', 'cancelado')
     ORDER BY s.id DESC LIMIT 1`,
    [clienteWhatsapp]
  );
  return rows[0] || null;
};

// Servicio activo de un conductor
const activoConductor = async (conductorWhatsapp) => {
  const [rows] = await db.execute(
    `SELECT * FROM servicios
     WHERE conductor_whatsapp = ?
       AND estado IN ('asignado', 'en_punto', 'en_curso')
     ORDER BY id DESC LIMIT 1`,
    [conductorWhatsapp]
  );
  return rows[0] || null;
};

// Servicios pendientes sin conductor (para redespacho)
const pendientesSinConductor = async () => {
  const [rows] = await db.execute(
    `SELECT * FROM servicios
     WHERE estado = 'pendiente' AND conductor_whatsapp IS NULL
     ORDER BY created_at ASC`
  );
  return rows;
};

// Historial de un cliente
const historialCliente = async (clienteWhatsapp, limite = 10) => {
  const [rows] = await db.execute(
    `SELECT s.*,
            co.nombre AS conductor_nombre,
            co.placa
     FROM servicios s
     LEFT JOIN conductores co ON s.conductor_whatsapp = co.whatsapp_no
     WHERE s.cliente_whatsapp = ?
     ORDER BY s.id DESC LIMIT ?`,
    [clienteWhatsapp, limite]
  );
  return rows;
};

// Historial de un conductor
const historialConductor = async (conductorWhatsapp, limite = 10) => {
  const [rows] = await db.execute(
    `SELECT s.*,
            cl.nombre AS cliente_nombre
     FROM servicios s
     LEFT JOIN clientes cl ON s.cliente_whatsapp = cl.whatsapp_no
     WHERE s.conductor_whatsapp = ?
     ORDER BY s.id DESC LIMIT ?`,
    [conductorWhatsapp, limite]
  );
  return rows;
};

// ── Actualizaciones de estado ────────────────────────────────

const asignarConductor = async (id, conductorWhatsapp) => {
  await db.execute(
    `UPDATE servicios
     SET conductor_whatsapp = ?, estado = 'asignado', hora_asignacion = NOW()
     WHERE id = ?`,
    [conductorWhatsapp, id]
  );
};

const setETA = async (id, minutos) => {
  await db.execute(
    'UPDATE servicios SET eta_minutos = ? WHERE id = ?',
    [minutos, id]
  );
};

const marcarEnPunto = async (id) => {
  await db.execute(
    `UPDATE servicios SET estado = 'en_punto', hora_llegada_punto = NOW() WHERE id = ?`,
    [id]
  );
};

const marcarEnCurso = async (id) => {
  await db.execute(
    `UPDATE servicios SET estado = 'en_curso', hora_inicio_viaje = NOW() WHERE id = ?`,
    [id]
  );
};

const completar = async (id) => {
  await db.execute(
    `UPDATE servicios SET estado = 'completado', hora_fin = NOW() WHERE id = ?`,
    [id]
  );
};

const cancelar = async (id) => {
  await db.execute(
    `UPDATE servicios SET estado = 'cancelado', hora_fin = NOW() WHERE id = ?`,
    [id]
  );
};

const setNotas = async (id, notas) => {
  await db.execute(
    'UPDATE servicios SET notas = ? WHERE id = ?',
    [notas, id]
  );
};

// ── Notificaciones a conductores ─────────────────────────────

const registrarNotificacion = async (servicioId, conductorWhatsapp) => {
  await db.execute(
    `INSERT INTO servicio_notificaciones (servicio_id, conductor_whatsapp, estado)
     VALUES (?, ?, 'enviado')
     ON DUPLICATE KEY UPDATE estado = 'enviado', updated_at = NOW()`,
    [servicioId, conductorWhatsapp]
  );
};

const marcarNotificacionAceptada = async (servicioId, conductorWhatsapp) => {
  await db.execute(
    `UPDATE servicio_notificaciones SET estado = 'aceptado'
     WHERE servicio_id = ? AND conductor_whatsapp = ?`,
    [servicioId, conductorWhatsapp]
  );
};

const marcarNotificacionRechazada = async (servicioId, conductorWhatsapp) => {
  await db.execute(
    `UPDATE servicio_notificaciones SET estado = 'rechazado'
     WHERE servicio_id = ? AND conductor_whatsapp = ?`,
    [servicioId, conductorWhatsapp]
  );
};

const vencerNotificacionesRestantes = async (servicioId, exceptoWhatsapp) => {
  await db.execute(
    `UPDATE servicio_notificaciones SET estado = 'vencido'
     WHERE servicio_id = ? AND conductor_whatsapp != ? AND estado = 'enviado'`,
    [servicioId, exceptoWhatsapp]
  );
};

const vencerTodasNotificaciones = async (servicioId) => {
  await db.execute(
    `UPDATE servicio_notificaciones SET estado = 'vencido'
     WHERE servicio_id = ? AND estado = 'enviado'`,
    [servicioId]
  );
};

// Conductores notificados que aún no respondieron
const notificacionesPendientes = async (servicioId) => {
  const [rows] = await db.execute(
    `SELECT conductor_whatsapp FROM servicio_notificaciones
     WHERE servicio_id = ? AND estado = 'enviado'`,
    [servicioId]
  );
  return rows;
};

// Conductores notificados que quedaron vencidos (para avisar que fue tomado)
const notificacionesVencidas = async (servicioId, exceptoWhatsapp) => {
  const [rows] = await db.execute(
    `SELECT conductor_whatsapp FROM servicio_notificaciones
     WHERE servicio_id = ? AND conductor_whatsapp != ? AND estado = 'vencido'`,
    [servicioId, exceptoWhatsapp]
  );
  return rows;
};

// ── Estadísticas admin ───────────────────────────────────────

const resumenHoy = async () => {
  const [rows] = await db.execute(
    `SELECT
       COUNT(*)                                              AS total,
       SUM(estado = 'completado')                           AS completados,
       SUM(estado = 'cancelado')                            AS cancelados,
       SUM(estado NOT IN ('completado','cancelado'))        AS activos,
       AVG(TIMESTAMPDIFF(MINUTE, created_at, hora_fin))     AS promedio_minutos
     FROM servicios
     WHERE DATE(created_at) = CURDATE()`
  );
  return rows[0];
};

module.exports = {
  setConnection,
  crear,
  porId,
  activoCliente,
  activoConductor,
  pendientesSinConductor,
  historialCliente,
  historialConductor,
  asignarConductor,
  setETA,
  marcarEnPunto,
  marcarEnCurso,
  completar,
  cancelar,
  setNotas,
  registrarNotificacion,
  marcarNotificacionAceptada,
  marcarNotificacionRechazada,
  vencerNotificacionesRestantes,
  vencerTodasNotificaciones,
  notificacionesPendientes,
  notificacionesVencidas,
  resumenHoy,
};
