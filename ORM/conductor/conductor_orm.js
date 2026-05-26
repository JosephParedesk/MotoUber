// ============================================================
// ORM/conductor/conductor_orm.js
// CRUD de la tabla `conductores`
// Reemplaza a ORM/owner/owner_orm.js
// ============================================================
'use strict';

let db;

const setConnection = (con) => { db = con; };

// ── Buscar ───────────────────────────────────────────────────

const existe = async (whatsapp) => {
  const [rows] = await db.execute(
    'SELECT * FROM conductores WHERE whatsapp_no = ? LIMIT 1', [whatsapp]
  );
  return rows[0] || null;
};

const todos = async () => {
  const [rows] = await db.execute(
    'SELECT * FROM conductores WHERE activo = 1 ORDER BY nombre'
  );
  return rows;
};

const online = async () => {
  const [rows] = await db.execute(
    `SELECT * FROM conductores WHERE estado = 'online' AND activo = 1`
  );
  return rows;
};

const ocupados = async () => {
  const [rows] = await db.execute(
    `SELECT * FROM conductores WHERE estado = 'ocupado' AND activo = 1`
  );
  return rows;
};

// ── Crear / registrar ────────────────────────────────────────

const registrar = async ({ whatsapp, nombre, placa, modelo, foto }) => {
  const [result] = await db.execute(
    `INSERT INTO conductores (whatsapp_no, nombre, placa, modelo_moto, foto_url)
     VALUES (?, ?, ?, ?, ?)`,
    [whatsapp, nombre, placa, modelo || null, foto || null]
  );
  return result.insertId;
};

// ── Actualizaciones de estado ────────────────────────────────

const setEstadoDB = async (whatsapp, estado) => {
  // estado = 'offline' | 'online' | 'ocupado'
  await db.execute(
    `UPDATE conductores SET estado = ?, ultimo_ping = NOW() WHERE whatsapp_no = ?`,
    [estado, whatsapp]
  );
};

const setEstadoConv = async (whatsapp, estadoConv) => {
  await db.execute(
    `UPDATE conductores SET estado_conv = ?, ultimo_ping = NOW() WHERE whatsapp_no = ?`,
    [estadoConv, whatsapp]
  );
};

// Actualiza estado BD y conversacional al mismo tiempo
const setEstados = async (whatsapp, estadoDB, estadoConv) => {
  await db.execute(
    `UPDATE conductores SET estado = ?, estado_conv = ?, ultimo_ping = NOW()
     WHERE whatsapp_no = ?`,
    [estadoDB, estadoConv, whatsapp]
  );
};

const ping = async (whatsapp) => {
  await db.execute(
    'UPDATE conductores SET ultimo_ping = NOW() WHERE whatsapp_no = ?',
    [whatsapp]
  );
};

const desactivar = async (whatsapp) => {
  await db.execute(
    `UPDATE conductores SET activo = 0, estado = 'offline', estado_conv = 0
     WHERE whatsapp_no = ?`,
    [whatsapp]
  );
};

const activar = async (whatsapp) => {
  await db.execute(
    'UPDATE conductores SET activo = 1 WHERE whatsapp_no = ?',
    [whatsapp]
  );
};

// ── Jornadas ─────────────────────────────────────────────────

const iniciarJornada = async (whatsapp) => {
  await db.execute(
    'INSERT INTO jornadas (conductor_whatsapp) VALUES (?)', [whatsapp]
  );
  await setEstados(whatsapp, 'online', 1);
};

const finalizarJornada = async (whatsapp) => {
  await db.execute(
    `UPDATE jornadas SET fin = NOW()
     WHERE conductor_whatsapp = ? AND fin IS NULL`, [whatsapp]
  );
  await setEstados(whatsapp, 'offline', 0);
};

const jornadaActiva = async (whatsapp) => {
  const [rows] = await db.execute(
    `SELECT *, TIMESTAMPDIFF(MINUTE, inicio, NOW()) AS minutos_activo
     FROM jornadas
     WHERE conductor_whatsapp = ? AND fin IS NULL
     ORDER BY id DESC LIMIT 1`,
    [whatsapp]
  );
  return rows[0] || null;
};

const sumarServicio = async (whatsapp) => {
  await db.execute(
    `UPDATE jornadas SET servicios_realizados = servicios_realizados + 1
     WHERE conductor_whatsapp = ? AND fin IS NULL`,
    [whatsapp]
  );
};

const historialJornadas = async (whatsapp, limite = 10) => {
  const [rows] = await db.execute(
    `SELECT *, TIMESTAMPDIFF(MINUTE, inicio, COALESCE(fin, NOW())) AS minutos_total
     FROM jornadas
     WHERE conductor_whatsapp = ?
     ORDER BY id DESC LIMIT ?`,
    [whatsapp, limite]
  );
  return rows;
};

// ── Estadísticas ─────────────────────────────────────────────

const resumenHoy = async (whatsapp) => {
  const [rows] = await db.execute(
    `SELECT
       COUNT(s.id)                              AS servicios_completados,
       TIMESTAMPDIFF(MINUTE, j.inicio, NOW())   AS minutos_en_jornada
     FROM jornadas j
     LEFT JOIN servicios s
       ON s.conductor_whatsapp = j.conductor_whatsapp
      AND s.estado = 'completado'
      AND DATE(s.hora_fin) = CURDATE()
     WHERE j.conductor_whatsapp = ?
       AND DATE(j.inicio) = CURDATE()
       AND j.fin IS NULL
     LIMIT 1`,
    [whatsapp]
  );
  return rows[0] || { servicios_completados: 0, minutos_en_jornada: 0 };
};

module.exports = {
  setConnection,
  existe,
  todos,
  online,
  ocupados,
  registrar,
  setEstadoDB,
  setEstadoConv,
  setEstados,
  ping,
  desactivar,
  activar,
  iniciarJornada,
  finalizarJornada,
  jornadaActiva,
  sumarServicio,
  historialJornadas,
  resumenHoy,
};
