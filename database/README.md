# Módulo de Base de Datos y Persistencia Dual (`database/`)

## 1. Propósito e Importancia Crítica en el Sistema
El módulo `database/` administra la capa de persistencia integral, redundante e inmutable del Sistema de Cajero Automático. Implementa una arquitectura **Dual-Write Concurrente** de alta resiliencia diseñada para tolerar fallas de infraestructura:

1. **Motor Primario (MySQL 8.4 InnoDB):** Gestiona la integridad referencial estricta, claves foráneas, índices de alta velocidad y transacciones ACID con soporte de bloqueos pesimistas (`SELECT ... FOR UPDATE`).
2. **Motor de Respaldo Transparente (SQLite 3):** Archivo embebido local `database/atm_system.db`, que asume automáticamente la carga de transacciones si la instancia de MySQL no responde o se encuentra fuera de línea.
3. **Persistencia Plana Paralela (Flat Files):** Archivos de texto plano estructurados mediante plecas (`|`) en `database/storage_txt/` y `data/storage_txt/`, protegidos con `asyncio.Lock()`. Esta capa asegura la continuidad operativa y auditoría forense inmediata aun ante la pérdida total de los motores relacionales.

### ¿Por qué es crítico?
- **Prohibición Total de `DELETE FROM` (Soft Delete Obligatorio):** En cumplimiento de la normativa bancaria, ninguna fila se elimina físicamente de la base de datos. Los registros se desactivan lógicamente y se archivan con trazabilidad completa para el usuario y el auditor.
- **Trazabilidad Forense Inmutable:** Cada movimiento contable, retiro, depósito, cambio de PIN o baja queda registrado en la bitácora relacional (`logs_auditoria`, `registros_eliminados`) y paralelamente en texto plano (`auditoria_eventos.txt`, `bajas_eliminaciones.txt`).

---

## 2. Estructura de Archivos y Responsabilidad de Componentes

```
database/
├── connection.py                # Configuración de SQLAlchemy: pool de conexiones MySQL con reconexión y fallback SQLite.
├── init_db.py                   # Script de semillado: inicializa tablas, roles, 5 empleados corporativos y Q9,850.00 en bóveda.
├── models.py                    # Declaración de entidades SQLAlchemy (Role, Usuario, Tarjeta, DenominacionCajero, etc.).
├── schema.sql                   # Archivo DDL en SQL puro con especificación de tablas, constraints y datos iniciales.
├── txt_manager.py               # Motor Dual-Write asíncrono: lectura y escritura coordinada en archivos planos con asyncio.Lock.
├── storage_txt/                 # Directorio de persistencia plana síncrona:
│   ├── usuarios.txt             # Directorio de usuarios: ID|Nombre|Tarjeta|Hash|Saldo|Límite|Retirado|PIN_Flag|Acceso|Estado
│   ├── cajero_inventario.txt    # Stock en tiempo real: TOTAL_BOVEDA y desglose de las 7 denominaciones en Quetzales.
│   ├── transacciones_historico.txt # Histórico inmutable de retiros y depósitos con desglose JSON.
│   ├── auditoria_eventos.txt    # Registro cronológico de logins, fallos mecánicos y cambios de configuración.
│   └── bajas_eliminaciones.txt  # Bitácora estricta de bajas lógicas y archivado de entidades.
└── README.md                    # Documentación técnica del subsistema y directrices de trabajo multiagente.
```

---

## 3. Diccionario de Datos y Modelos Relacionales

### 3.1 `roles` (Control de Acceso RBAC)
- `id_rol` (INT, PK, Auto-increment)
- `nombre_rol` (VARCHAR(50), UNIQUE): Catálogo de privilegios (`ADMINISTRADOR`, `USUARIO`).

### 3.2 `usuarios` (Cuentas Corporativas Bancarias)
- `id_usuario` (INT, PK, Auto-increment)
- `id_rol` (INT, FK -> roles.id_rol)
- `nombre_completo` (VARCHAR(100))
- `pin_hash` (VARCHAR(255)): Hash SHA-256 salteado (`ATM_SALT_2026:PIN`).
- `token_temporal` (VARCHAR(10)): Semilla para generación dinámica TOTP.
- `saldo_actual` (DECIMAL(12,2)): Saldo contable disponible.
- `monto_max_diario` (DECIMAL(12,2)): Tope de retiro diario asignado (default Q2,000.00).
- `total_retirado_hoy` (DECIMAL(12,2)): Monto acumulado retirado durante la jornada vigente.
- `cambio_pin_realizado` (BOOLEAN): Bandera de cumplimiento de cambio de clave inicial.
- `fecha_ultimo_acceso` (DATETIME): Marca temporal del último inicio de sesión exitoso.
- `activo` (BOOLEAN): Estado operativo de la cuenta.
- **Columnas de Soft Delete:**
  - `is_deleted` (BOOLEAN, default FALSE): Flag de baja lógica.
  - `deleted_at` (DATETIME, nullable): Momento exacto de la baja.
  - `deleted_by_id` (INT, nullable): Identificador del administrador autorizador.

### 3.3 `tarjetas` (Plásticos Asignados)
- `id_tarjeta` (INT, PK, Auto-increment)
- `id_usuario` (INT, FK -> usuarios.id_usuario)
- `numero_tarjeta` (VARCHAR(16), UNIQUE): 16 dígitos numéricos del plástico.
- `activa` (BOOLEAN): Indica si es la tarjeta primaria activa del usuario.
- `fecha_asignacion` (DATETIME): Fecha de emisión.
- `is_deleted` (BOOLEAN, default FALSE) & `deleted_at` (DATETIME): Baja lógica de la tarjeta al ser sustituida.

### 3.4 `denominaciones_cajero` (Inventario de Bóveda)
- `id_denominacion` (INT, PK, Auto-increment)
- `denominacion` (INT, UNIQUE): Denominación oficial en Quetzales: `200, 100, 50, 20, 10, 5, 1`.
- `cantidad_billetes` (INT): Cantidad física de piezas disponibles en el cartucho dispensador.

### 3.5 `arqueos_cajero` (Cargas de Bóveda)
- `id_arqueo` (INT, PK, Auto-increment)
- `tipo_evento` (VARCHAR(20)): `INICIALIZACION` (máximo Q10,000.00) o `RECARGA` (tope acumulado Q30,000.00).
- `monto_total` (DECIMAL(12,2))
- `fecha_evento` (DATETIME)

### 3.6 `transacciones` (Histórico de Movimientos)
- `id_transaccion` (INT, PK, Auto-increment)
- `id_usuario` (INT, FK -> usuarios.id_usuario)
- `tipo_transaccion` (VARCHAR(20)): `RETIRO` o `DEPOSITO`.
- `monto` (DECIMAL(12,2))
- `fecha_hora` (DATETIME)
- `desglose_billetes` (JSON): Mapeo exacto de piezas dispensadas/recibidas, ej: `{"100": 1, "20": 1, "1": 3}`.

### 3.7 `registros_eliminados` (Auditoría Inmutable de Bajas Lógicas)
- `id_eliminacion` (INT, PK, Auto-increment)
- `tabla_origen` (VARCHAR(50)): Nombre de la tabla de la entidad dada de baja (`usuarios`, `tarjetas`).
- `id_registro_origen` (INT): Clave primaria del registro desactivado.
- `datos_eliminados_json` (JSON): Instantánea completa de los datos y balances al momento de la baja.
- `motivo` (VARCHAR(255)): Justificación formal de la operación.
- `eliminado_por_id` (INT) & `eliminado_por_nombre` (VARCHAR(100)): Auditor responsable.
- `id_usuario_afectado` (INT): Usuario al que pertenece el registro (para transparencia en su panel).
- `visible_para_usuario` (BOOLEAN, default TRUE)
- `fecha_eliminacion` (DATETIME)

---

## 4. Guía Operativa de Ejecución y Mantenimiento

### Inicialización y Semillado de la Base de Datos:
```bash
python database/init_db.py
```
Este comando crea automáticamente todas las tablas relacionales, siembra los roles, crea el usuario administrador, los 5 empleados corporativos y abastece la bóveda con **Q9,850.00**.

### Regenerar Persistencia Plana desde la Base de Datos:
```bash
python -c "import asyncio; from database.connection import SessionLocal; from database.txt_manager import txt_manager; db = SessionLocal(); asyncio.run(txt_manager.sync_all_from_db(db)); db.close(); print('Sincronización completa')"
```

---

## 5. Directrices para el Agente de IA (`feature/database-dualwrite`)

- **Rama Exclusiva:** `feature/database-dualwrite` (prohibido hacer push directo a `main`).
- **Inmutabilidad y Soft Delete:** Queda estrictamente vetado ejecutar `DELETE FROM` o `DROP TABLE`. Toda eliminación debe implementarse como baja lógica mediante `RegistroEliminado` y las banderas `is_deleted`.
- **Doble Escritura Obligatoria:** Todo cambio en usuarios, inventario o transacciones debe actualizar tanto la base relacional como los archivos en `database/storage_txt/` a través de `txt_manager.py`.
- **Compatibilidad de Esquemas:** Si se añaden columnas a las tablas, deben ser nulleables o tener un valor por defecto para no romper el código existente.
