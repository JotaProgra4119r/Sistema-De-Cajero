# Catálogo Arquitectónico de Submódulos Desacoplados (`modules/`)
### Sistema Bancario y Cajero Automático Embebido (ATM Kiosk)

El sistema se encuentra desacoplado en **4 submódulos independientes**, eliminando cualquier acoplamiento circular o dependencia cruzada no autorizada. Cada submódulo dispone de su propio espacio de trabajo, dependencias aisladas, contratos de interfaz y suite de pruebas unitarias.

---

## 🏗️ Mapa de Submódulos

```text
modules/
├── frontend/        # React 18, TypeScript, Tailwind CSS, Electron Kiosk (1080p)
├── backend/         # Python FastAPI, SQLAlchemy, WebSockets, JWT, TOTP, Algoritmo DP
├── database/        # MySQL 8.4 InnoDB / SQLite DualWrite Engine + Parser .txt + Soft Delete
└── hardware/        # Arduino Mega 2560 (7 motores A4988 / 7 IR), ESP32-CAM (OV2640 / HC-SR04)
```

---

## 📦 Especificaciones por Submódulo

### 1. 💻 `modules/frontend/`
* **Tecnologías:** React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite, Electron.
* **Resolución Kiosco:** Fija a 1920x1080 px (modo táctil sin marcos OS, barra Discord personalizada).
* **Seguridad Electron:**
  - `nodeIntegration: false` y `contextIsolation: true`.
  - Navegación externa y apertura de ventanas bloqueada (`will-navigate`, `setWindowOpenHandler: deny`).
  - Atajos de riesgo desactivados en producción (`Alt+F4`, `Ctrl+R`, `F12`).
  - Preload seguro exponiendo exclusivamente métodos de control de ventana vía IPC.
* **Documentación completa:** [`modules/frontend/README.md`](frontend/README.md)

### 2. ⚙️ `modules/backend/`
* **Tecnologías:** Python 3.14, FastAPI, Pydantic v2, PyJWT, WebSockets.
* **Contratos REST:** OpenAPI 3.0 interactivo en `/docs`.
* **Algoritmo de Dispensación:**
  - Algoritmo de Programación Dinámica y Backtracking con Branch-and-Bound para combinaciones óptimas de billetes ante montos no estándar (ej. Q123.00, Q239.00).
  - Validación previa de existencias físicas antes de iniciar el débito contable.
* **Transacciones ACID y Rollback:**
  - En caso de evento `JAM_DETECTED` emitido por los sensores ópticos de hardware, se cancela la operación y no se ejecuta débito contable alguno.
* **Documentación completa:** [`modules/backend/README.md`](backend/README.md)

### 3. 🗄️ `modules/database/`
* **Tecnologías:** SQLAlchemy 2.0, PyMySQL, SQLite 3 (fallback automático), AsyncIO Lock.
* **Persistencia Dual Concurrente:**
  - Base Relacional: MySQL InnoDB (conmutación transparente a SQLite `atm_system.db`).
  - Archivos Planos Delimitados por Plecas: `usuarios.txt`, `cajero_inventario.txt`, `transacciones_historico.txt`, `auditoria_eventos.txt`, `bajas_eliminaciones.txt` y `auditoria_eliminaciones.txt`.
* **Política de Soft Delete y Auditoría Forense:**
  - Prohibición estricta de `DELETE` físico en tablas maestras.
  - Las entidades se desactivan lógicamente (`is_active = FALSE`, `is_deleted = TRUE`).
  - Registro inmutable en `auditoria_eliminaciones.txt`: `timestamp|registro_id|operador_id|motivo_baja|snapshot_anterior_json`.
* **Documentación completa:** [`modules/database/README.md`](database/README.md)

### 4. 🔌 `modules/hardware/`
* **Tecnologías:** C++ (Arduino Core), ATmega2560, ESP32-WROOM-32, PySerial.
* **Protocolo Serie Seguro con Checksum:**
  - Tramas serie estructuradas con Checksum XOR (`PAYLOAD*XX`) para prevenir inyecciones espurias y Hardware Spoofing.
  - Timeout estricto de lectura en PySerial (1.5 segundos).
* **Actuadores y Sensores:**
  - 7 Motores paso a paso A4988 y 7 sensores infrarrojos de ranura para eyección y verificación de billetes.
  - Cámara OV2640 (streaming de auditoría) y sensor ultrasónico HC-SR04 (telemetría de proximidad).
* **Documentación completa:** [`modules/hardware/README.md`](sensors/README.md)

---

## 🧪 Ejecución de Pruebas Unitarias Aisladas
```bash
# Correr suite completa de pruebas del sistema
python -m pytest backend/tests/ -v
```
