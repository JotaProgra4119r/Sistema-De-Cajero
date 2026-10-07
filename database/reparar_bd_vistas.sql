-- =============================================================================
-- REPARACIÓN Y CREACIÓN DE VISTAS PARA SQL MANAGEMENT STUDIO / WORKBENCH
-- Base de Datos: atm_system
-- Este script crea las vistas oficiales 'retiros' y 'depositos' vinculadas a 'transacciones'
-- para que se visualicen inmediatamente como objetos de primer orden en SQL Management.
-- =============================================================================

USE atm_system;

-- 1. Vista Oficial de Retiros
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

-- 2. Vista Oficial de Depósitos
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

-- 3. Verificación de Integridad
SELECT 'Vista retiros creada con éxito. Total registros:' AS estado, COUNT(*) AS total FROM retiros;
SELECT 'Vista depositos creada con éxito. Total registros:' AS estado, COUNT(*) AS total FROM depositos;
