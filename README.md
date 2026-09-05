# Sistema Bancario y Cajero Automático Embebido (ATM Kiosk)

Proyecto integral de terminal de autoservicio bancario con estética visual inspirada en Discord (modo oscuro profundo, tarjetas modulares, microinteracciones táctiles, resolución 1920x1080), backend transaccional en Python FastAPI con soporte para retiros de montos no estandarizados (ej. Q123.00, Q239.00), persistencia dual concurrente (MySQL InnoDB + archivos planos delimitados por plecas `.txt`), emulación y firmware embebido para Arduino Mega 2560 (7 motores paso a paso y sensores ópticos IR) y ESP32-CAM (cámara OV2640 y sensor ultrasónico HC-SR04).

---

## 🚀 Requisitos del Sistema y Tecnologías

* **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite, Electron (Modo Kiosco Pantalla Completa).
* **Backend:** Python 3.14 (FastAPI, Uvicorn, SQLAlchemy, Pydantic, PyJWT, PySerial, WebSockets).
* **Persistencia Dual Concurrente:**
  * Base de Datos Relacional: MySQL Server 8.4 (con conmutador transparente automático a SQLite de respaldo para ejecución inmediata sin configuración previa).
  * Archivos Planos Obligatorios: `./data/storage_txt/` (`usuarios.txt`, `cajero_inventario.txt`, `transacciones_historico.txt`, `auditoria_eventos.txt`).
* **Firmware Embebido:**
  * Arduino Mega 2560 (C++ / `.ino`): Control de 7 drivers A4988 / motores paso a paso y 7 sensores infrarrojos de ranura.
  * ESP32-CAM (C++ / `.ino`): Streaming de video OV2640 y telemetría de proximidad con sensor ultrasónico HC-SR04.

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

## 🛠️ Instrucciones de Ejecución Rápida

### Opción 1: Lanzador Todo en Uno
Haga doble clic en:
```bash
run_all.bat
```
Este script arrancará automáticamente el servidor backend en `http://127.0.0.1:8000` y abrirá la terminal Kiosco en Electron.

### Opción 2: Ejecución Manual por Componente

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

## 📂 Documentación Completa del Proyecto

* [ANALISIS_DISENO_EPS.md](file:///docs/ANALISIS_DISENO_EPS.md): Matrices de Entradas, Procesos y Salidas para las 10 operaciones.
* [MANUAL_TECNICO.md](file:///docs/MANUAL_TECNICO.md): Arquitectura, esquemas DDL, protocolos serie y diagramas Mermaid.
* [MANUAL_USUARIO.md](file:///docs/MANUAL_USUARIO.md): Guía paso a paso ilustrada para el usuario y el administrador.
