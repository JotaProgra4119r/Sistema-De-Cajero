# Sistema Bancario y Cajero Automático Embebido (ATM Kiosk)

Proyecto integral de terminal de autoservicio bancario con estética visual inspirada en Discord (modo oscuro profundo, tarjetas modulares, microinteracciones táctiles, resolución 1920x1080), backend transaccional en Python FastAPI con soporte para retiros de montos no estandarizados (ej. Q123.00, Q239.00), persistencia dual concurrente (MySQL InnoDB + archivos planos delimitados por plecas `.txt`), emulación y firmware embebido para Arduino Mega 2560 (7 motores paso a paso y sensores ópticos IR) y ESP32-CAM (cámara OV2640 y sensor ultrasónico HC-SR04).

---

## 🚀 Requisitos del Sistema y Tecnologías

* **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite, Electron (Modo Kiosco Pantalla Completa).
* **Backend:** Python 3.14 (FastAPI, Uvicorn, SQLAlchemy, Pydantic, PyJWT, PySerial, WebSockets).
* **Persistencia Dual Concurrente:**
  * Base de Datos Relacional: MySQL Server 8.4 (con conmutador transparente automático a SQLite de respaldo para ejecución inmediata sin configuración previa).
  * Archivos Planos Obligatorios: `./database/storage_txt/` y `./data/storage_txt/` (`usuarios.txt`, `cajero_inventario.txt`, `transacciones_historico.txt`, `auditoria_eventos.txt`, `bajas_eliminaciones.txt`).
* **Firmware Embebido:**
  * Arduino Mega 2560 (C++ / `.ino`): Control de 7 drivers A4988 / motores paso a paso y 7 sensores infrarrojos de ranura.
  * ESP32-CAM (C++ / `.ino`): Streaming de video OV2640 y telemetría de proximidad con sensor ultrasónico HC-SR04.

---

## 🧩 Los 4 Módulos Desacoplados del Sistema

Cada subsistema cuenta con su propio `README.md` técnico exhaustivo, arquitectura independiente y su respectiva rama de desarrollo multiagente para no afectar el nodo principal (`main`):

1. 💻 [**Módulo de Frontend y Kiosco Táctil** (`frontend/README.md`)](file:///frontend/README.md): React 18, Vite, Tailwind CSS, Electron Kiosk. Rama: `feature/frontend-kiosk`.
2. ⚙️ [**Módulo de Backend y Core Transaccional** (`backend/README.md`)](file:///backend/README.md): FastAPI, WebSockets, MFA TOTP Anti-Replay, reglas bancarias. Rama: `feature/backend-core`.
3. 🗄️ [**Módulo de Base de Datos y Persistencia Dual** (`database/README.md`)](file:///database/README.md): MySQL 8.4 InnoDB, SQLite fallback, Soft Delete inmutable y sincronización `.txt`. Rama: `feature/database-dualwrite`.
4. 🔌 [**Módulo de Sensores, Controladores y Firmware** (`sensors/README.md`)](file:///sensors/README.md): Arduino Mega 2560 (C++), ESP32-CAM (cámara OV2640 y HC-SR04), protocolo JSON RS-232. Rama: `feature/sensors-firmware`.

---

## 🔑 Credenciales de Acceso de Prueba

### Terminal Usuario (Modo Autoservicio)
* **Empleado 1:**
  * Tarjeta: `1234-5678-1234-5678`
  * PIN: `1234`
  * Token Dinámico: `456789` (o el token TOTP vigente en pantalla)
  * Saldo Inicial: Q3,500.00 | Límite Diario: Q2,000.00
* **Empleado 2:**
  * Tarjeta: `2345-6789-2345-6789` | PIN: `1234` | Saldo: Q4,800.00 | Límite: Q2,500.00
* **Empleado 3:**
  * Tarjeta: `3456-7890-3456-7890` | PIN: `1234` | Saldo: Q1,500.00 | Límite: Q1,500.00
* **Empleado 4:**
  * Tarjeta: `4567-8901-4567-8901` | PIN: `1234` | Saldo: Q6,200.00 | Límite: Q3,000.00
* **Empleado 5:**
  * Tarjeta: `5678-9012-5678-9012` | PIN: `1234` | Saldo: Q2,100.00 | Límite: Q2,000.00

### Consola de Administración
* **Administrador de Bóveda:**
  * Tarjeta: `9999-8888-7777-6666`
  * PIN: `1234`
  * Token Dinámico: `123456` (o el token TOTP vigente en pantalla)

---

## 🛠️ Instrucciones de Instalación y Ejecución

El proyecto está preparado para ejecutarse bajo dos modalidades inmediatas ("solo instalar y abrir"): mediante **Docker** (tanto en Windows como en Linux Debian) o de forma **Nativa Directa**.

---

### 🐳 Modalidad 1: Contenedor Docker ("Solo Instalar y Abrir")

Tanto en Windows como en Linux Debian se incluye orquestación completa con `docker-compose.yml` que levanta el backend FastAPI (Python 3.12) y el frontend Nginx con proxy inverso, volumen persistente para archivos `.txt` y healthcheck automático.

#### En Windows (Docker Desktop):
Haga doble clic en:
```cmd
docker-run.bat
```
*(O ejecute `docker compose up -d` y abra `http://localhost:5173`)*.

#### En Linux Debian / Ubuntu:
Ejecute en la terminal:
```bash
chmod +x docker-run.sh
./docker-run.sh
```
*(El script detecta Docker, construye las imágenes, levanta los contenedores y lanza Chromium en modo Kiosco a pantalla completa).*

Para detener los contenedores:
```bash
docker compose down
```

---

### 🖥️ Modalidad 2: Ejecución Nativa Directa (Scripts Automatizados)

Si prefiere ejecutar sin Docker, se proporcionan instaladores y lanzadores automáticos de un solo clic:

#### En Windows:
1. **Instalación de dependencias (solo la primera vez):**
   ```cmd
   install_windows.bat
   ```
2. **Lanzamiento de aplicación y servidor:**
   ```cmd
   run_windows.bat
   ```
   *(Inicia FastAPI en segundo plano y despliega la ventana Kiosco en Electron).*

#### En Linux Debian:
1. **Instalación de paquetes del sistema y entornos:**
   ```bash
   chmod +x install_debian.sh run_debian.sh
   ./install_debian.sh
   ```
2. **Lanzamiento:**
   ```bash
   ./run_debian.sh
   ```

---

### 📦 Compilación de Binarios Distribuidos (Electron Builder)

Para generar instaladores independientes empaquetados:
* **Instalador y Portable para Windows (`.exe` NSIS / x64):**
  ```bash
  cd frontend
  npm run pack:win
  ```
  *(Genera el instalador `CajeroAutomaticoKiosk Setup 0.0.0.exe` en `frontend/release/`)*.
* **Paquete Debian (`.deb` / `AppImage` para Linux):**
  ```bash
  cd frontend
  npm run pack:linux
  ```
  *(Genera el binario `.deb` listo para `dpkg -i` en `frontend/release/`)*.

---

### Opción 3: Ejecución Manual por Componente

1. **Iniciar Servidor Backend:**
   ```powershell
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   * Documentación interactiva Swagger: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   * Verificación de salud: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

2. **Iniciar Interfaz Kiosco (Frontend):**
   ```powershell
   cd frontend
   npm run electron:dev
   ```
   * O en navegador web: `npm run dev` en [http://localhost:5173](http://localhost:5173)

---

## 🧪 Pruebas Automatizadas

Para ejecutar la suite completa de pruebas unitarias y de integración bancaria:
```powershell
python -m pytest backend/tests/ -v
```

Cobertura de pruebas incluidas:
* `test_login_user_success` y `test_login_invalid_pin`
* `test_custom_withdrawal_q123` (Dispensación no estándar de Q123.00 con desglose exacto)
* `test_custom_withdrawal_inconsistent_bills` (Rechazo automático ante inconsistencia aritmética)
* `test_daily_limit_exceeded` (Bloqueo si el retiro supera el cupo diario remanente)
* `test_deposit_and_last_transactions` (Depósito y extracción directa de transacciones en `.txt`)
* `test_admin_vault_rules` (Límite estricto de inicialización $\le \text{Q10,000.00}$ y recarga $\le \text{Q30,000.00}$)
* `test_jam_rollback` (Simulación de atasco mecánico con cancelación total y preservación de saldos)
* `test_dual_write` (Verificación de los cuatro archivos planos en `./data/storage_txt/`)

---

## 🤖 Herramientas de Soporte Multiagente (Graphify)

El repositorio incorpora la herramienta de análisis estático multiagente **Graphify**:
* **Función:** Mapea el repositorio generando un grafo de dependencias determinista mediante **AST Tree-sitter** (sin consumo de tokens LLM en el análisis de código) y agrupa los módulos en comunidades conceptuales mediante el algoritmo de **Leiden**.
* **Instalación y uso:**
  ```bash
  uv tool install graphifyy
  graphify extract . --code-only
  graphify cluster-only .
  ```
* **Archivos resultantes:**
  * `graphify-out/GRAPH_REPORT.md`: Reporte estructural con comunidades de código, hubs principales y grados de centralidad (306 nodos, 553 aristas, 27 comunidades).
  * `graphify-out/graph.json`: Estructura serializada de grafo transferible a agentes de IA para inyectar únicamente el contexto relevante de clases e interfaces, logrando **un ahorro de hasta un 70% en consumo de tokens**.

---

## 📂 Documentación Completa del Proyecto

* [ANALISIS_DISENO_EPS.md](file:///docs/ANALISIS_DISENO_EPS.md): Matrices de Entradas, Procesos y Salidas para las 10 operaciones.
* [MANUAL_TECNICO.md](file:///docs/MANUAL_TECNICO.md): Arquitectura, esquemas DDL, protocolos serie y diagramas Mermaid.
* [MANUAL_USUARIO.md](file:///docs/MANUAL_USUARIO.md): Guía paso a paso ilustrada para el usuario y el administrador.
* [GUIA_GITHUB_Y_RAMAS.md](file:///docs/GUIA_GITHUB_Y_RAMAS.md): Guía de flujo de trabajo GitFlow, ramas modulares y protección de CI/CD para el equipo.
