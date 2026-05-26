-- ============================================================
-- MOTO CENTRAL WHATSAPP - Esquema de base de datos
-- Reemplaza completamente al esquema de WhatsAppCabBookingBot
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";
SET NAMES utf8mb4;

-- ============================================================
-- TABLA: conductores
-- Almacena datos de cada conductor y su estado en tiempo real
-- ============================================================
CREATE TABLE `conductores` (
  `id`                  INT           NOT NULL AUTO_INCREMENT,
  `whatsapp_no`         VARCHAR(20)   NOT NULL UNIQUE COMMENT 'Número con código de país: +573001234567',
  `nombre`              VARCHAR(100)  NOT NULL,
  `placa`               VARCHAR(20)   NOT NULL UNIQUE,
  `modelo_moto`         VARCHAR(100)  DEFAULT NULL,
  `foto_url`            VARCHAR(255)  DEFAULT NULL COMMENT 'Ruta local o URL de la foto del vehículo',
  `estado`              ENUM('offline','online','ocupado') NOT NULL DEFAULT 'offline'
                        COMMENT 'offline=jornada no iniciada, online=disponible, ocupado=en servicio',
  `estado_conv`         INT           NOT NULL DEFAULT 0
                        COMMENT 'Estado conversacional interno del flujo de botones',
  `activo`              TINYINT(1)    NOT NULL DEFAULT 1 COMMENT '0 = conductor desactivado por admin',
  `ultimo_ping`         DATETIME      DEFAULT NULL COMMENT 'Último mensaje recibido del conductor',
  `created_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_estado` (`estado`),
  KEY `idx_whatsapp` (`whatsapp_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Conductores registrados en el sistema';


-- ============================================================
-- TABLA: clientes
-- Almacena datos del cliente y su estado conversacional
-- ============================================================
CREATE TABLE `clientes` (
  `id`                  INT           NOT NULL AUTO_INCREMENT,
  `whatsapp_no`         VARCHAR(20)   NOT NULL UNIQUE,
  `nombre`              VARCHAR(100)  DEFAULT NULL,
  `estado_conv`         INT           NOT NULL DEFAULT 0
                        COMMENT '0=inicio, 1=esperando ubicacion, 2=confirmando, 3=esperando conductor, 4=en servicio',
  `ultima_actividad`    DATETIME      DEFAULT NULL,
  `created_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_whatsapp` (`whatsapp_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Clientes que solicitan servicios';


-- ============================================================
-- TABLA: servicios
-- Cada solicitud de moto es un registro aquí
-- ============================================================
CREATE TABLE `servicios` (
  `id`                    INT           NOT NULL AUTO_INCREMENT,
  `cliente_whatsapp`      VARCHAR(20)   NOT NULL,
  `conductor_whatsapp`    VARCHAR(20)   DEFAULT NULL COMMENT 'NULL hasta que un conductor acepta',

  -- Ubicación del cliente
  `ubicacion_texto`       TEXT          DEFAULT NULL COMMENT 'Referencia escrita o dirección',
  `ubicacion_lat`         DECIMAL(10,7) DEFAULT NULL COMMENT 'Latitud si el cliente comparte ubicación GPS',
  `ubicacion_lng`         DECIMAL(10,7) DEFAULT NULL COMMENT 'Longitud si el cliente comparte ubicación GPS',

  -- Destino (opcional, se puede pedir después)
  `destino_texto`         TEXT          DEFAULT NULL,
  `destino_lat`           DECIMAL(10,7) DEFAULT NULL,
  `destino_lng`           DECIMAL(10,7) DEFAULT NULL,

  -- Estado del servicio
  `estado`                ENUM(
                            'pendiente',    -- Recién creado, buscando conductor
                            'asignado',     -- Conductor aceptó, va en camino
                            'en_punto',     -- Conductor llegó al punto de recogida
                            'en_curso',     -- Cliente abordó, viaje en progreso
                            'completado',   -- Servicio finalizado
                            'cancelado'     -- Cancelado por cliente o sistema
                          ) NOT NULL DEFAULT 'pendiente',

  -- Tiempos del servicio
  `eta_minutos`           INT           DEFAULT NULL COMMENT 'ETA informado por el conductor',
  `hora_asignacion`       DATETIME      DEFAULT NULL,
  `hora_llegada_punto`    DATETIME      DEFAULT NULL,
  `hora_inicio_viaje`     DATETIME      DEFAULT NULL,
  `hora_fin`              DATETIME      DEFAULT NULL,

  -- Tarifa (opcional para futuras versiones)
  `tarifa`                DECIMAL(10,2) DEFAULT NULL,
  `notas`                 TEXT          DEFAULT NULL,

  `created_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_cliente` (`cliente_whatsapp`),
  KEY `idx_conductor` (`conductor_whatsapp`),
  KEY `idx_estado` (`estado`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cada solicitud de servicio de moto';


-- ============================================================
-- TABLA: servicio_notificaciones
-- Rastreo de a qué conductores se notificó cada servicio
-- Permite saber quién ya rechazó o si el servicio fue tomado
-- ============================================================
CREATE TABLE `servicio_notificaciones` (
  `id`                  INT         NOT NULL AUTO_INCREMENT,
  `servicio_id`         INT         NOT NULL,
  `conductor_whatsapp`  VARCHAR(20) NOT NULL,
  `estado`              ENUM(
                          'enviado',    -- Notificación enviada, sin respuesta aún
                          'aceptado',   -- Este conductor tomó el servicio
                          'rechazado',  -- Conductor rechazó explícitamente
                          'vencido'     -- Otro conductor tomó el servicio primero
                        ) NOT NULL DEFAULT 'enviado',
  `created_at`          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_servicio_conductor` (`servicio_id`, `conductor_whatsapp`),
  KEY `idx_servicio` (`servicio_id`),
  KEY `idx_conductor` (`conductor_whatsapp`),
  KEY `idx_estado` (`estado`),
  CONSTRAINT `fk_notif_servicio` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Control de envío de notificaciones a conductores por servicio';


-- ============================================================
-- TABLA: jornadas
-- Historial de jornadas laborales de cada conductor
-- ============================================================
CREATE TABLE `jornadas` (
  `id`                  INT         NOT NULL AUTO_INCREMENT,
  `conductor_whatsapp`  VARCHAR(20) NOT NULL,
  `inicio`              DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fin`                 DATETIME    DEFAULT NULL COMMENT 'NULL si la jornada está activa',
  `servicios_realizados` INT        NOT NULL DEFAULT 0,
  `created_at`          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conductor` (`conductor_whatsapp`),
  KEY `idx_inicio` (`inicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial de jornadas laborales';


-- ============================================================
-- TABLA: admins
-- Números de WhatsApp con acceso administrativo
-- ============================================================
CREATE TABLE `admins` (
  `id`            INT         NOT NULL AUTO_INCREMENT,
  `whatsapp_no`   VARCHAR(20) NOT NULL UNIQUE,
  `nombre`        VARCHAR(100) DEFAULT NULL,
  `activo`        TINYINT(1)  NOT NULL DEFAULT 1,
  `created_at`    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Administradores con acceso a comandos especiales';


-- ============================================================
-- DATOS INICIALES
-- ¡IMPORTANTE! Antes de correr el sistema por primera vez:
--   1. Edita el .env y pon tu número real en ADMIN_WHATSAPP
--   2. El sistema lee ADMIN_WHATSAPP al arrancar y registra el admin
--      automáticamente (ver index.js → runMigration + seedAdmin)
-- El INSERT de abajo es solo un fallback de ejemplo; el número real
-- lo inyecta el código desde process.env.ADMIN_WHATSAPP
-- ============================================================

-- Admin se inserta desde código usando process.env.ADMIN_WHATSAPP
-- (ver función seedAdmin en index.js)

-- Conductor de ejemplo (cambiar antes de usar en producción)
INSERT INTO `conductores` (`whatsapp_no`, `nombre`, `placa`, `modelo_moto`, `estado`) 
VALUES ('+573001111111', 'Carlos Ramírez', 'ABC123', 'Honda CB 125F 2023', 'offline')
ON DUPLICATE KEY UPDATE nombre = nombre;


-- ============================================================
-- VISTAS ÚTILES
-- ============================================================

-- Vista: conductores disponibles ahora mismo
CREATE VIEW `v_conductores_online` AS
  SELECT id, whatsapp_no, nombre, placa, modelo_moto, foto_url, ultimo_ping
  FROM conductores
  WHERE estado = 'online' AND activo = 1;

-- Vista: servicios activos con datos de cliente y conductor
CREATE VIEW `v_servicios_activos` AS
  SELECT 
    s.id,
    s.estado,
    s.ubicacion_texto,
    s.destino_texto,
    s.eta_minutos,
    s.created_at,
    s.hora_asignacion,
    cl.nombre   AS cliente_nombre,
    cl.whatsapp_no AS cliente_whatsapp,
    co.nombre   AS conductor_nombre,
    co.whatsapp_no AS conductor_whatsapp,
    co.placa,
    co.modelo_moto
  FROM servicios s
  LEFT JOIN clientes cl ON s.cliente_whatsapp = cl.whatsapp_no
  LEFT JOIN conductores co ON s.conductor_whatsapp = co.whatsapp_no
  WHERE s.estado NOT IN ('completado', 'cancelado');

-- Vista: resumen de jornada activa por conductor
CREATE VIEW `v_jornada_activa` AS
  SELECT 
    j.conductor_whatsapp,
    c.nombre,
    j.inicio,
    j.servicios_realizados,
    TIMESTAMPDIFF(MINUTE, j.inicio, NOW()) AS minutos_en_jornada
  FROM jornadas j
  JOIN conductores c ON j.conductor_whatsapp = c.whatsapp_no
  WHERE j.fin IS NULL;

COMMIT;
