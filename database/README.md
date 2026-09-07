# Módulo de Base de Datos y Persistencia Dual (Database Module)

## 1. Visión General y Arquitectura
El módulo `database/` administra la capa de persistencia transaccional y redundante del Sistema de Cajero Automático. Implementa una arquitectura **Dual-Write** de alta disponibilidad:
1. **Motor Relacional Primario:** MySQL 8.4 bajo motor transaccional InnoDB con claves foráneas estrictas y soporte de transacciones ACID (`SELECT ... FOR UPDATE` para operaciones de inventario de bóveda).
2. **Motor Relacional de Respaldo:** SQLite 3 (`atm_system.db`), activado de manera transparente en caso de fallos de red o de instancia MySQL local.
3. **Persistencia Plana (Flat-Files):** Sistema síncrono de archivos de texto con separador `|` en `database/storage_txt/` (y espejo en `data/storage_txt/`), garantizando resiliencia ante caídas totales del RDBMS y auditoría forense inmediata sin herramientas SQL.

---

## 2. Política Estricta de Borrado Lógico (Soft Delete)
En este sistema bancario **queda estrictamente prohibida la ejecución de sentencias `DELETE FROM` destructivas**.
- **Entidades Auditadas:** `usuarios` y `tarjetas` disponen de columnas `is_deleted` (BOOLEAN), `deleted_at` (DATETIME) y `deleted_by_id` (INT).
- **Tabla Inmutable `registros_eliminados`:** Cada vez que un usuario o tarjeta es dado de baja o desactivado:
  - Se registra el ID original y el nombre de la tabla de origen (`usuarios` o `tarjetas`).
  - Se guarda una copia serializada en JSON de todos los datos que poseía el registro en el instante de su eliminación.
  - Se almacena el autor de la baja (`eliminado_por_id`, `eliminado_por_nombre`) y el motivo formal (`motivo`).
  - Se vincula al usuario afectado (`id_usuario_afectado`) con la bandera `visible_para_usuario = TRUE`.
  - Se registra el evento en `storage_txt/bajas_eliminaciones.txt`.
- **Transparencia para el Usuario Final:** El cliente puede consultar en su panel (`/api/v1/user/audit/deleted-records`) el historial exacto de tarjetas desactivadas, bloqueadas o registros modificados que le pertenecen, con el motivo y la fecha.

---

## 3. Diccionario de Datos y Modelos
- **`roles`:** Catálogo de privilegios RBAC (`ADMINISTRADOR`, `USUARIO`).
- **`usuarios`:** Cuentas corporativas, saldo actual, límite de retiro diario (Q2,000.00 por defecto), total retirado en el día y flags de soft-delete.
- **`tarjetas`:** Tarjetas de 16 dígitos asociadas a usuarios. Soporta migración o sustitución de tarjeta conservando el historial y límite diario acumulado.
- **`denominaciones_cajero`:** Bóveda con las 7 denominaciones oficiales en Quetzales:
  - Q200, Q100, Q50, Q20, Q10, Q5, Q1.
- **`arqueos_cajero`:** Eventos de carga inicial o recarga de efectivo en bóveda.
- **`transacciones`:** Histórico inmutable de retiros y depósitos con desglose JSON detallado de billetes entregados/recibidos.
- **`logs_auditoria`:** Bitácora de eventos del sistema (login, intentos fallidos, cambios de PIN, alarmas de sensores).
- **`registros_eliminados`:** Bitácora inmutable de bajas lógicas y archivado de entidades.

---

## 4. Guía Operativa y Ejecución
### Inicialización y Semillado:
```bash
python database/init_db.py
```
Este comando:
1. Crea todas las tablas en el motor activo (MySQL o SQLite de respaldo).
2. Semilla los roles `ADMINISTRADOR` y `USUARIO`.
3. Crea el usuario administrador y las 5 cuentas de prueba corporativas.
4. Carga el inventario inicial de bóveda con **Q9,850.00**.

---

## 5. Estrategia Multiagente GitFlow
Para proteger la rama de producción (`main`), todos los agentes que modifiquen esquemas, modelos o gestores de almacenamiento deben operar bajo su rama delegada:

- **Rama Asignada:** `feature/database-dualwrite`
- **Reglas de Aislamiento:**
  1. No realizar commits directos en `main`.
  2. Prohibido ejecutar scripts DDL destructivos (`DROP TABLE`, `TRUNCATE`).
  3. Toda nueva columna debe ser retrocompatible (`NULL` o con valor por defecto).
  4. Mantener la sincronización dual en `txt_manager.py` con bloqueo por hilo (`asyncio.Lock`).
  5. Ejecutar los tests de persistencia y soft-delete antes de solicitar PR hacia `main`.
