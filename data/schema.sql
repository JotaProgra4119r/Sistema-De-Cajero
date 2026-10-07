-- =============================================================================
-- SISTEMA BANCARIO Y CAJERO AUTOMÁTICO EMBEBIDO (ATM KIOSK) v1.0.2
-- Script DDL y DML de Creación y Semillado de Base de Datos Relacional
-- Motor Oficial: MySQL 8.0+ / 8.4 InnoDB
-- Codificación: UTF-8 (utf8mb4)
-- =============================================================================

DROP DATABASE IF EXISTS atm_system;
CREATE DATABASE atm_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE atm_system;

-- -----------------------------------------------------------------------------
-- 1. TABLA: roles (Control de Acceso Basado en Roles - RBAC)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT INTO roles (id_rol, nombre_rol) VALUES 
(1, 'ADMINISTRADOR'), 
(2, 'USUARIO');

-- -----------------------------------------------------------------------------
-- 2. TABLA: usuarios (Cuentas Corporativas Bancarias con Soft Delete)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    id_rol INT NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    token_temporal VARCHAR(10) NULL,
    saldo_actual DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    monto_max_diario DECIMAL(12,2) NOT NULL DEFAULT 2000.00,
    total_retirado_hoy DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    cambio_pin_realizado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_ultimo_acceso DATETIME NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at DATETIME NULL,
    deleted_by_id INT NULL,
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol) ON UPDATE CASCADE
) ENGINE=InnoDB;

INSERT INTO usuarios (id_usuario, id_rol, nombre_completo, pin_hash, token_temporal, saldo_actual, monto_max_diario, total_retirado_hoy, cambio_pin_realizado, fecha_ultimo_acceso, activo) VALUES
(1, 1, 'Administrador de Bóveda', 'c439ac33bf281432082c9a8afc3b1d8e0c551e0589c3e5bae9e96fb6dce193d4', '123456', 0.00, 999999.00, 0.00, FALSE, CURRENT_TIMESTAMP, TRUE),
(2, 2, 'Carlos Roberto Gómez',    'c439ac33bf281432082c9a8afc3b1d8e0c551e0589c3e5bae9e96fb6dce193d4', '456789', 3500.00, 2000.00, 0.00, FALSE, CURRENT_TIMESTAMP, TRUE),
(3, 2, 'María Andrea López',      'c439ac33bf281432082c9a8afc3b1d8e0c551e0589c3e5bae9e96fb6dce193d4', '456789', 4800.00, 2500.00, 0.00, FALSE, CURRENT_TIMESTAMP, TRUE),
(4, 2, 'Juan Fernando Pérez',     'c439ac33bf281432082c9a8afc3b1d8e0c551e0589c3e5bae9e96fb6dce193d4', '456789', 1500.00, 1500.00, 0.00, FALSE, CURRENT_TIMESTAMP, TRUE),
(5, 2, 'Sofía Isabel Morales',    'c439ac33bf281432082c9a8afc3b1d8e0c551e0589c3e5bae9e96fb6dce193d4', '456789', 6200.00, 3000.00, 0.00, FALSE, CURRENT_TIMESTAMP, TRUE),
(6, 2, 'Diego Alejandro Ruiz',    'c439ac33bf281432082c9a8afc3b1d8e0c551e0589c3e5bae9e96fb6dce193d4', '456789', 2100.00, 2000.00, 0.00, FALSE, CURRENT_TIMESTAMP, TRUE);

-- -----------------------------------------------------------------------------
-- 3. TABLA: tarjetas (Plásticos Asignados de 16 Dígitos con Soft Delete)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarjetas (
    id_tarjeta INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    numero_tarjeta VARCHAR(16) NOT NULL UNIQUE,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_asignacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at DATETIME NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE
) ENGINE=InnoDB;

INSERT INTO tarjetas (id_tarjeta, id_usuario, numero_tarjeta, activa, fecha_asignacion) VALUES
(1, 1, '9999888877776666', TRUE, CURRENT_TIMESTAMP),
(2, 2, '1234567812345678', TRUE, CURRENT_TIMESTAMP),
(3, 3, '2345678923456789', TRUE, CURRENT_TIMESTAMP),
(4, 4, '3456789034567890', TRUE, CURRENT_TIMESTAMP),
(5, 5, '4567890145678901', TRUE, CURRENT_TIMESTAMP),
(6, 6, '5678901256789012', TRUE, CURRENT_TIMESTAMP);

-- -----------------------------------------------------------------------------
-- 4. TABLA: denominaciones_cajero (Inventario Físico de Billetes en Bóveda)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS denominaciones_cajero (
    id_denominacion INT AUTO_INCREMENT PRIMARY KEY,
    denominacion INT UNIQUE NOT NULL,
    cantidad_billetes INT NOT NULL DEFAULT 0,
    CONSTRAINT chk_denominacion CHECK (denominacion IN (200, 100, 50, 20, 10, 5, 1))
) ENGINE=InnoDB;

INSERT INTO denominaciones_cajero (denominacion, cantidad_billetes) VALUES   
(200, 20),
(100, 30),
(50,  30),
(20,  40),
(10,  35),
(5,   30),
(1,   50);

-- -----------------------------------------------------------------------------
-- 5. TABLA: arqueos_cajero (Auditoría de Cargas e Inicializaciones de Bóveda)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS arqueos_cajero (
    id_arqueo INT AUTO_INCREMENT PRIMARY KEY,
    tipo_evento VARCHAR(20) NOT NULL,
    monto_total DECIMAL(12,2) NOT NULL,
    fecha_evento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO arqueos_cajero (id_arqueo, tipo_evento, monto_total, fecha_evento) VALUES
(1, 'INICIALIZACION', 9850.00, CURRENT_TIMESTAMP);

-- -----------------------------------------------------------------------------
-- 6. TABLA: transacciones (Histórico Financiero: Retiros y Depósitos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transacciones (
    id_transaccion INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    tipo_transaccion VARCHAR(20) NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    desglose_billetes JSON NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 7. TABLA: logs_auditoria (Bitácora de Eventos de Seguridad y Accesos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id_log INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NULL,
    accion VARCHAR(100) NOT NULL,
    detalles TEXT NULL,
    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO logs_auditoria (id_usuario, accion, detalles, fecha_hora) VALUES
(1, 'INICIALIZACION_SISTEMA', 'Semillado inicial de tablas, 6 usuarios corporativos y Q9,850.00 en bóveda.', CURRENT_TIMESTAMP);

-- -----------------------------------------------------------------------------
-- 8. TABLA: registros_eliminados (Bitácora Inmutable de Bajas Lógicas Soft-Delete)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registros_eliminados (
    id_eliminacion INT AUTO_INCREMENT PRIMARY KEY,
    tabla_origen VARCHAR(50) NOT NULL,
    id_registro_origen INT NOT NULL,
    datos_eliminados_json JSON NOT NULL,
    motivo VARCHAR(255) NULL,
    eliminado_por_id INT NULL,
    eliminado_por_nombre VARCHAR(100) NULL,
    id_usuario_afectado INT NULL,
    visible_para_usuario BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_eliminacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 9. VISTAS SQL: retiros y depositos (Para Visualización en SQL Management Studio)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW retiros AS
SELECT 
    t.id_transaccion,
    t.id_usuario,
    u.nombre_completo AS cliente,
    t.monto,
    t.fecha_hora,
    t.desglose_billetes
FROM transacciones t
JOIN usuarios u ON t.id_usuario = u.id_usuario
WHERE t.tipo_transaccion = 'RETIRO';

CREATE OR REPLACE VIEW depositos AS
SELECT 
    t.id_transaccion,
    t.id_usuario,
    u.nombre_completo AS cliente,
    t.monto,
    t.fecha_hora,
    t.desglose_billetes
FROM transacciones t
JOIN usuarios u ON t.id_usuario = u.id_usuario
WHERE t.tipo_transaccion = 'DEPOSITO';
