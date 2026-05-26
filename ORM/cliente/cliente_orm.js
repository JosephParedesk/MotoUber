// ============================================================
// ORM/cliente/cliente_orm.js
// CRUD de la tabla `clientes`
// Reemplaza a ORM/user/user_orm.js
// ============================================================
'use strict';

let db;

const setConnection = (con) => { db = con; };

// ── Buscar / crear ───────────────────────────────────────────

const existe = async (whatsapp) => {
  const [rows] = await db.execute(
    'SELECT * FROM clientes WHERE whatsapp_no = ? LIMIT 1', [whatsapp]
  );
  return rows[0] || null;
};

// Inserta si no existe, actualiza ultima_actividad si ya existe
const upsert = async (whatsapp) => {
  await db.execute(
    `INSERT INTO clientes (whatsapp_no, estado_conv)
     VALUES (?, 0)
     ON DUPLICATE KEY UPDATE ultima_actividad = NOW()`,
    [whatsapp]
  );
  return existe(whatsapp);
};

// ── Actualizaciones ──────────────────────────────────────────

const setNombre = async (whatsapp, nombre) => {
  await db.execute(
    'UPDATE clientes SET nombre = ?, ultima_actividad = NOW() WHERE whatsapp_no = ?',
    [nombre, whatsapp]
  );
};

const setEstado = async (whatsapp, estado) => {
  await db.execute(
    'UPDATE clientes SET estado_conv = ?, ultima_actividad = NOW() WHERE whatsapp_no = ?',
    [estado, whatsapp]
  );
};

const setActividad = async (whatsapp) => {
  await db.execute(
    'UPDATE clientes SET ultima_actividad = NOW() WHERE whatsapp_no = ?',
    [whatsapp]
  );
};

// ── Consultas ────────────────────────────────────────────────

// Clientes con servicio activo hace más de X minutos sin conductor (para renotificar)
const sinConductorDesde = async (minutos = 10) => {
  const [rows] = await db.execute(
    `SELECT c.whatsapp_no, c.nombre, s.id AS servicio_id, s.ubicacion_texto
     FROM clientes c
     JOIN servicios s ON s.cliente_whatsapp = c.whatsapp_no
     WHERE s.estado = 'pendiente'
       AND TIMESTAMPDIFF(MINUTE, s.created_at, NOW()) >= ?`,
    [minutos]
  );
  return rows;
};

module.exports = {
  setConnection,
  existe,
  upsert,
  setNombre,
  setEstado,
  setActividad,
  sinConductorDesde,
};
