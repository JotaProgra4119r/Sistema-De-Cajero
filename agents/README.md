# Subsistema Multiagente Graphify (`agents/`)

## 1. Vision Arquitectonica
El subsistema de agentes implementa un enjambre de 4 agentes especializados desacoplados del flujo principal (`main`) mediante un bus asincrono de eventos (`EventBus`). Cada agente cumple una funcion vital de seguridad, consistencia contable, diagnostico de hardware o modularidad arquitectonica.

```
                    +------------------------+
                    |  EventBus / Mediator   |
                    +-----------+------------+
                                |
        +---------------+-------+-------+---------------+
        |               |               |               |
+-------v-------+ +-----v-------+ +-----v-------+ +-----v-------+
| Agent-Sentinel| | Agent-Ledger| |Agent-Diag-  | |Agent-Context|
| (Seguridad y  | |(Dual-Write y| | nostics     | |(AST Graphify|
| Anti-Replay)  | |Consistencia)| |(IR & Jam)   | | Modularidad)|
+---------------+ +-------------+ +-------------+ +-------------+
```

## 2. Descripcion de los 4 Agentes

### 2.1 Agent-Sentinel (`agent_sentinel.py`)
- **Mision:** Seguridad de transacciones y prevencion de fraude en tiempo de ejecucion.
- **Responsabilidades:**
  - Audita saldos contables antes del debito.
  - Verifica topes diarios y cupos restantes.
  - Mitiga ataques de repeticion (replay attacks) mediante tokens dinamicos TOTP.

### 2.2 Agent-Ledger (`agent_ledger.py`)
- **Mision:** Consistencia y paridad contable entre almacenamiento relacional y archivos planos.
- **Responsabilidades:**
  - Audita que la suma en MySQL/SQLite coincida con `cajero_inventario.txt`.
  - Asegura que los snapshots de Soft Delete queden registrados en `auditoria_eliminaciones.txt` y `bajas_eliminaciones.txt`.
  - Ejecuta sincronizacion en segundo plano sin bloquear el hilo de ejecucion transaccional.

### 2.3 Agent-Diagnostics (`agent_diagnostics.py`)
- **Mision:** Telemetria de sensores y mitigacion de atascos fisicos.
- **Responsabilidades:**
  - Procesa la lectura de los 7 sensores infrarrojos de ranura (IR) y el sensor ultrasonico HC-SR04.
  - En caso de deteccion de atasco mecanico (`JAM_DETECTED`), emite de inmediato la senal de cancelacion y asiste en el rollback contable.

### 2.4 Agent-Context (`agent_context.py`)
- **Mision:** Validacion y cumplimiento de arquitectura basada en AST.
- **Responsabilidades:**
  - Lee y valida `graphify-out/graph.json` (347 nodos, 647 enlaces, 30 comunidades).
  - Previene dependencias circulares entre `modules/frontend`, `modules/backend`, `modules/database` y `modules/hardware`.
