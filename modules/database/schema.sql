-- Schema DDL: Sistema Bancario y Cajero Automático Embebido
-- Motor primario: MySQL 8.4 InnoDB (con soporte para SQLite)
CREATE DATABASE IF NOT EXISTS atm_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE atm_system;

-- Catálogo de roles de acceso (RBAC)
CREATE TABLE IF NOT EXISTS roles (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(20) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT IGNORE INTO roles (id_rol, nombre_rol) VALUES 
(1, 'ADMINISTRADOR'), 
(2, 'USUARIO');

-- Entidad de usuarios corporativos (5 trabajadores + 1 admin)
-- Incluye columnas para auditoría y borrado lógico estricto (Soft Delete)
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    id_rol INT NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    token_temporal VARCHAR(10) NULL,
    saldo_actual DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    monto_max_diario DECIMAL(12,2) NOT NULL DEFAULT 2000.00,
    total_retirado_hoy DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    fecha_ultimo_acceso DATETIME NULL,
    cambio_pin_realizado BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at DATETIME NULL,
    deleted_by_id INT NULL,
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
) ENGINE=InnoDB;

-- Histórico de tarjetas con borrado lógico
CREATE TABLE IF NOT EXISTS tarjetas (
    id_tarjeta INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    numero_tarjeta CHAR(16) NOT NULL UNIQUE,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_emision DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at DATETIME NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

-- Inventario de billetes en bóveda (7 denominaciones oficiales)
CREATE TABLE IF NOT EXISTS denominaciones_cajero (
    id_denominacion INT AUTO_INCREMENT PRIMARY KEY,
    denominacion INT UNIQUE NOT NULL,
    cantidad_billetes INT NOT NULL DEFAULT 0,
    CHECK (denominacion IN (200, 100, 50, 20, 10, 5, 1))
) ENGINE=InnoDB;

INSERT IGNORE INTO denominaciones_cajero (denominacion, cantidad_billetes) VALUES   
(200, 20), (100, 30), (50, 30), (20, 40), (10, 35), (5, 30), (1, 50);

-- Registro de arqueos e inicializaciones
CREATE TABLE IF NOT EXISTS arqueos_cajero (
    id_arqueo INT AUTO_INCREMENT PRIMARY KEY,
    tipo_evento ENUM('INICIALIZACION', 'RECARGA') NOT NULL,
    monto_total DECIMAL(12,2) NOT NULL,
    fecha_evento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Histórico general de transacciones
CREATE TABLE IF NOT EXISTS transacciones (
    id_transaccion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    tipo_transaccion ENUM('RETIRO', 'DEPOSITO') NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    desglose_billetes JSON NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

-- Bitácora de auditoría general
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id_log BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NULL,
    accion VARCHAR(100) NOT NULL,
    detalles TEXT NULL,
    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bitácora inmutable de eliminaciones y desactivaciones lógicas (Soft Delete)
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
