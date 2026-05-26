// ============================================================
// index.js — Moto Central WhatsApp Bot (Evolution API)
// ============================================================
'use strict';

const express  = require('express');
const dotenv   = require('dotenv');
const mysql    = require('mysql2/promise');
const fs       = require('fs');

dotenv.config();

// ── Módulos internos ─────────────────────────────────────────
const wa         = require('./whatsapp/evolution');
const despacho   = require('./dispatcher/despacho');
const cs         = require('./conductor_state/conductor_state');
const cls        = require('./cliente_state/cliente_state');
const adminState = require('./admin_state/admin_state');
const { ETA_ROW_IDS } = cs;

// Mapa de ETA por número de respuesta
const ETA_MAP = { '1': 3, '2': 5, '3': 10, '4': 15, '5': 20, '6': 30 };

// ── Helpers ──────────────────────────────────────────────────

const toE164 = (numero) => {
  const limpio = numero.replace(/\D/g, '');
  return '+' + limpio;
};

// ── Enviar mensaje ────────────────────────────────────────────

const enviar = async (numero, msg) => {
  if (!msg) return;
  if (typeof msg === 'string') return wa.sendText(numero, msg);
  return wa.sendText(numero, msg.text || JSON.stringify(msg));
};

// ── Base de datos ────────────────────────────────────────────

let db;

const connectDatabase = async () => {
  const pool = await mysql.createPool({
    host              : process.env.DB_HOST,
    port              : parseInt(process.env.DB_PORT) || 3306,
    user              : process.env.DB_USERNAME,
    password          : process.env.DB_PASSWORD,
    database          : process.env.MYSQL_DATABASE,
    multipleStatements: true,
    socketPath        : undefined,
    waitForConnections: true,
    connectionLimit   : 10,
  });
  await pool.query(`SET time_zone = '${process.env.TIME_ZONE || 'America/Bogota'}';`);
  console.log('✅ Base de datos conectada');
  await runMigration(pool);
  return pool;
};

const runMigration = async (pool) => {
  const [rows] = await pool.query('SHOW TABLES;');
  if (rows.length === 0) {
    console.log('⚙️  Ejecutando migración...');
    const sql = fs.readFileSync('whatsapp_cab_bot.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Migración completada.');
  }
  await seedAdmin(pool);
};

const seedAdmin = async (pool) => {
  const numero = process.env.ADMIN_WHATSAPP;
  const nombre = process.env.ADMIN_NOMBRE || 'Admin Principal';
  if (!numero) return;
  await pool.execute(
    `INSERT INTO admins (whatsapp_no, nombre, activo) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), activo = 1`,
    [numero, nombre]
  );
  console.log(`✅ Admin: ${numero}`);
};

// ── Helpers de BD ─────────────────────────────────────────────

const getCliente = async (whatsapp) => {
  const [rows] = await db.execute('SELECT * FROM clientes WHERE whatsapp_no = ? LIMIT 1', [whatsapp]);
  return rows[0] || null;
};

const upsertCliente = async (whatsapp) => {
  await db.execute(
    `INSERT INTO clientes (whatsapp_no, estado_conv) VALUES (?, 0)
     ON DUPLICATE KEY UPDATE ultima_actividad = NOW()`,
    [whatsapp]
  );
  return getCliente(whatsapp);
};

const setEstadoCliente = async (whatsapp, estado) => {
  await db.execute(
    'UPDATE clientes SET estado_conv = ?, ultima_actividad = NOW() WHERE whatsapp_no = ?',
    [estado, whatsapp]
  );
};

const getConductor = async (whatsapp) => {
  const [rows] = await db.execute('SELECT * FROM conductores WHERE whatsapp_no = ? LIMIT 1', [whatsapp]);
  return rows[0] || null;
};

const setEstadoConductor = async (whatsapp, estadoConv) => {
  await db.execute(
    'UPDATE conductores SET estado_conv = ?, ultimo_ping = NOW() WHERE whatsapp_no = ?',
    [estadoConv, whatsapp]
  );
};

const isAdmin = async (whatsapp) => {
  const [rows] = await db.execute(
    'SELECT id FROM admins WHERE whatsapp_no = ? AND activo = 1 LIMIT 1', [whatsapp]
  );
  return rows.length > 0;
};

// ── Express + Webhook ─────────────────────────────────────────

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok', bot: 'Moto Central' }));

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.event !== 'messages.upsert') return;

    const data = body.data;
    if (!data || !data.key) return;

    if (data.key.fromMe) return;
    if (data.key.remoteJid.includes('@g.us')) return;

    const jid     = data.key.remoteJid;
    const jidReal = (jid.includes('@lid') && data.key.remoteJidAlt)
                      ? data.key.remoteJidAlt
                      : jid;
    if (jidReal.includes('@lid')) return;

    const numero = toE164(jidReal);
    const msg    = data.message || {};

    const cuerpo = (
      msg.conversation
      || msg.extendedTextMessage?.text
      || msg.buttonsResponseMessage?.selectedDisplayText
      || msg.listResponseMessage?.title
      || ''
    ).trim();

    const tipo = msg.locationMessage ? 'location' : 'text';
    const location = msg.locationMessage
      ? { latitude: msg.locationMessage.degreesLatitude, longitude: msg.locationMessage.degreesLongitude }
      : null;

    const msgObj = { numero, jid: jidReal, cuerpo, tipo, location };

    console.log(`📨 ${numero} | Estado? | Cuerpo: "${cuerpo}"`);

    if (await isAdmin(numero)) {
      await adminState.manejar(msgObj, numero, cuerpo, '', '');
      return;
    }

    const conductor = await getConductor(numero);
    if (conductor) {
      await manejarConductor(msgObj, conductor);
      return;
    }

    await manejarCliente(msgObj, numero);

  } catch (err) {
    console.error('❌ Error en webhook:', err.message, err.stack);
  }
});

// ── FLUJO CONDUCTOR ───────────────────────────────────────────

const manejarConductor = async (msg, conductor) => {
  const { numero, cuerpo } = msg;
  const estado = conductor.estado_conv;

  console.log(`🚗 Conductor: ${numero} | Estado: ${estado} | Cuerpo: "${cuerpo}"`);

  // Estado 0: offline — responde "1" para iniciar
  if (estado === 0) {
    if (cuerpo === '1') {
      await db.execute(`UPDATE conductores SET estado = 'online', estado_conv = 1 WHERE whatsapp_no = ?`, [numero]);
      await db.execute(`INSERT INTO jornadas (conductor_whatsapp) VALUES (?)`, [numero]);
      const [jRow] = await db.execute(
        `SELECT servicios_realizados FROM jornadas WHERE conductor_whatsapp = ? AND DATE(inicio) = CURDATE() ORDER BY id DESC LIMIT 1`,
        [numero]
      );
      await enviar(numero, cs.enLinea(conductor.nombre, jRow[0]?.servicios_realizados || 0));
      return;
    }
    await enviar(numero, cs.bienvenida(conductor.nombre));
    return;
  }

  // Estado 1: online — responde "0" para finalizar
  if (estado === 1) {
    if (cuerpo === '0') {
      await db.execute(`UPDATE conductores SET estado = 'offline', estado_conv = 0 WHERE whatsapp_no = ?`, [numero]);
      await db.execute(`UPDATE jornadas SET fin = NOW() WHERE conductor_whatsapp = ? AND fin IS NULL`, [numero]);
      await enviar(numero, '👋 *Jornada finalizada.*\nDescansa bien. ¡Hasta pronto!');
      return;
    }
    const [jRow] = await db.execute(
      `SELECT servicios_realizados FROM jornadas WHERE conductor_whatsapp = ? AND fin IS NULL ORDER BY id DESC LIMIT 1`,
      [numero]
    );
    await enviar(numero, cs.enLinea(conductor.nombre, jRow[0]?.servicios_realizados || 0));
    return;
  }

  // Estado 2: notificado — "1" aceptar, "2" rechazar
  if (estado === 2) {
    const servicio = await despacho.getServicioActivoConductor(numero);

    if (cuerpo === '1') {
      if (!servicio) {
        await enviar(numero, cs.servicioYaTomado());
        await setEstadoConductor(numero, 1);
        return;
      }
      const resultado = await despacho.manejarAceptacion(numero, servicio.id);
      if (resultado.asignado) {
        await enviar(numero, cs.servicioAceptado(servicio.ubicacion_texto || 'Ver mapa'));
        await setEstadoConductor(numero, 3);
        await enviar(numero, cs.pedirETA());
      } else {
        await enviar(numero, cs.servicioYaTomado());
        await setEstadoConductor(numero, 1);
      }
      return;
    }

    if (cuerpo === '2') {
      if (servicio) await despacho.manejarRechazo(numero, servicio.id);
      await setEstadoConductor(numero, 1);
      await enviar(numero, cs.servicioRechazado());
      return;
    }

    if (servicio) await enviar(numero, cs.nuevoServicio(servicio.ubicacion_texto || 'GPS', null));
    return;
  }

  // Estado 3: aceptado, esperando ETA — responde 1-6
  if (estado === 3) {
    const minutos = ETA_MAP[cuerpo];
    if (minutos) {
      const servicio = await despacho.getServicioActivoConductor(numero);
      if (servicio) {
        await despacho.setETA(servicio.id, minutos);
        await enviar(servicio.cliente_whatsapp, cs.clienteNotificadoETA(minutos));
      }
      await setEstadoConductor(numero, 4);
      await enviar(numero, cs.ETAconfirmado(minutos));
      await enviar(numero, cs.enCamino(servicio?.ubicacion_texto || 'Punto de recogida', minutos));
      return;
    }
    await enviar(numero, cs.pedirETA());
    return;
  }

  // Estado 4: en camino — "1" para llegué al punto
  if (estado === 4) {
    if (cuerpo === '1') {
      const servicio = await despacho.getServicioActivoConductor(numero);
      if (servicio) {
        await despacho.conductorEnPunto(servicio.id, servicio.cliente_whatsapp);
        const [clRows] = await db.execute('SELECT nombre FROM clientes WHERE whatsapp_no = ? LIMIT 1', [servicio.cliente_whatsapp]);
        await setEstadoConductor(numero, 5);
        await enviar(numero, cs.enPunto(clRows[0]?.nombre || 'el cliente'));
      } else {
        await setEstadoConductor(numero, 1);
      }
      return;
    }
    const servicio = await despacho.getServicioActivoConductor(numero);
    await enviar(numero, cs.enCamino(servicio?.ubicacion_texto || 'Punto de recogida', servicio?.eta_minutos || '?'));
    return;
  }

  // Estado 5: en punto — "1" para finalizar servicio
  if (estado === 5) {
    if (cuerpo === '1') {
      const servicio = await despacho.getServicioActivoConductor(numero);
      if (servicio) {
        await despacho.finalizarServicio(servicio.id, numero, servicio.cliente_whatsapp);
      } else {
        await setEstadoConductor(numero, 1);
        await enviar(numero, '✅ Servicio finalizado. Ya estás disponible.');
      }
      return;
    }
    const [clRows] = await db.execute(
      `SELECT cl.nombre FROM servicios s JOIN clientes cl ON s.cliente_whatsapp = cl.whatsapp_no
       WHERE s.conductor_whatsapp = ? AND s.estado IN ('en_punto','en_curso') ORDER BY s.id DESC LIMIT 1`,
      [numero]
    );
    await enviar(numero, cs.enPunto(clRows[0]?.nombre || 'el cliente'));
    return;
  }

  await enviar(numero, cs.noEntendido());
};

// ── FLUJO CLIENTE ─────────────────────────────────────────────

const manejarCliente = async (msg, numero) => {
  const { cuerpo, tipo, location } = msg;
  let cliente  = await upsertCliente(numero);
  const estado = cliente.estado_conv;
  const esInicio = ['hola', 'hi', 'hello', 'inicio', 'start', 'menu'].includes(cuerpo.toLowerCase());

  console.log(`👤 Cliente: ${numero} | Estado: ${estado} | Cuerpo: "${cuerpo}"`);

  // Estado 0: nuevo usuario
  if (estado === 0) {
    await enviar(numero, cls.bienvenidaNuevo());
    await setEstadoCliente(numero, 1);
    return;
  }

  // Estado 1: esperando nombre
  if (estado === 1) {
    const nombre = cuerpo.trim();
    if (nombre.length > 1 && /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombre)) {
      await db.execute('UPDATE clientes SET nombre = ? WHERE whatsapp_no = ?', [nombre, numero]);
      await setEstadoCliente(numero, 2);
      cliente = await getCliente(numero);
      await enviar(numero, cls.menuPrincipal(nombre));
    } else {
      await enviar(numero, cls.nombreInvalido());
    }
    return;
  }

  // Cancelar desde cualquier estado
  if (cuerpo.toLowerCase() === 'cancelar') {
    const resultado = await despacho.cancelarServicio(numero);
    await enviar(numero, resultado.cancelado ? cls.cancelacionConfirmada() : cls.nada_que_cancelar());
    await setEstadoCliente(numero, 2);
    await enviar(numero, cls.menuPrincipal(cliente?.nombre));
    return;
  }

  // Reinicio desde cualquier estado
  if (esInicio && estado >= 2) {
    await setEstadoCliente(numero, 2);
    await enviar(numero, cls.menuPrincipal(cliente?.nombre));
    return;
  }

  // Estado 2: menú principal — "1" texto, "2" GPS
  if (estado === 2) {
    if (cuerpo === '1') {
      await setEstadoCliente(numero, 3);
      await enviar(numero, cls.pedirUbicacionTexto());
      return;
    }
    if (cuerpo === '2') {
      await setEstadoCliente(numero, 3);
      await enviar(numero, cls.pedirUbicacionGPS());
      return;
    }
    await enviar(numero, cls.menuPrincipal(cliente?.nombre));
    return;
  }

  // Estado 3: esperando ubicación
  if (estado === 3) {
    let ubicacionTexto = null;
    let lat = null, lng = null;

    if (tipo === 'location' && location) {
      lat = location.latitude;
      lng = location.longitude;
      ubicacionTexto = `📍 GPS: ${lat}, ${lng}`;
    } else if (cuerpo.length > 3) {
      ubicacionTexto = cuerpo;
    } else {
      await enviar(numero, cls.ubicacionNoEntendida());
      return;
    }

    const servicioId = await despacho.crearServicio(numero, ubicacionTexto, lat, lng);
    await db.execute(`UPDATE servicios SET notas = 'pendiente_confirmacion' WHERE id = ?`, [servicioId]);
    await setEstadoCliente(numero, 4);
    await enviar(numero, cls.confirmarServicio(ubicacionTexto));
    return;
  }

  // Estado 4: confirmando servicio — "1" confirmar, "2" cancelar
  if (estado === 4) {
    if (cuerpo === '1') {
      const [rows] = await db.execute(
        `SELECT id, ubicacion_texto, ubicacion_lat, ubicacion_lng FROM servicios
         WHERE cliente_whatsapp = ? AND notas = 'pendiente_confirmacion' ORDER BY id DESC LIMIT 1`,
        [numero]
      );
      if (!rows.length) {
        await setEstadoCliente(numero, 2);
        await enviar(numero, cls.errorGenerico());
        await enviar(numero, cls.menuPrincipal(cliente?.nombre));
        return;
      }
      const s = rows[0];
      await db.execute(`UPDATE servicios SET notas = NULL WHERE id = ?`, [s.id]);
      await setEstadoCliente(numero, 5);
      await enviar(numero, cls.buscandoConductor());
      const ubicacion = s.ubicacion_texto || `GPS: ${s.ubicacion_lat}, ${s.ubicacion_lng}`;
      await despacho.despacharServicio(s.id, numero, ubicacion);
      return;
    }
    if (cuerpo === '2') {
      await db.execute(`DELETE FROM servicios WHERE cliente_whatsapp = ? AND notas = 'pendiente_confirmacion'`, [numero]);
      await setEstadoCliente(numero, 2);
      await enviar(numero, cls.cancelacionConfirmada());
      await enviar(numero, cls.menuPrincipal(cliente?.nombre));
      return;
    }
    await enviar(numero, cls.confirmarServicio('(tu ubicación anterior)'));
    return;
  }

  // Estado 5: esperando conductor
  if (estado === 5) {
    await enviar(numero, cls.recordatorioEsperando());
    return;
  }

  // Estado 6: servicio en curso
  if (estado === 6) {
    const servicio = await despacho.getServicioActivoCliente(numero);
    if (servicio) {
      await enviar(numero, cls.servicioEnCurso({ nombre: servicio.conductor_nombre, placa: servicio.placa }));
    }
    return;
  }

  // Fallback
  await setEstadoCliente(numero, 2);
  await enviar(numero, cls.menuPrincipal(cliente?.nombre));
};

// ── Inicio ────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

connectDatabase()
  .then((con) => {
    db = con;
    despacho.init(enviar, con);
    adminState.init(enviar, con);
    console.log('⚙️  Módulos inicializados.');

    app.listen(PORT, () => {
      console.log(`🚀 Bot escuchando en puerto ${PORT}`);
      console.log(`📡 Webhook: POST http://localhost:${PORT}/webhook`);
    });
  })
  .catch((err) => {
    console.error('❌ Error iniciando:', err);
    process.exit(1);
  });