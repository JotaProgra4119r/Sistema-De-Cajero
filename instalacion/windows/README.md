# Guía de Instalación y Ejecución en Windows 10 / 11

### Sistema Bancario y Cajero Automático Embebido (ATM Kiosk)

Esta carpeta contiene todos los scripts y componentes optimizados para instalar, compilar y ejecutar el sistema en entornos **Windows**.

---

## 📋 1. Requisitos Previos

Asegúrate de tener instaladas las siguientes herramientas y agregadas al `PATH`:

1. **Python 3.10 o superior** (Marcando la casilla *"Add Python to PATH"* durante la instalación).
2. **Node.js 18+ y npm** ([Descargar Node.js LTS](https://nodejs.org/)).
3. **Git** ([Descargar Git para Windows](https://git-scm.com/)).
4. *(Opcional para modo contenedores)* **Docker Desktop** ([Descargar Docker Desktop](https://www.docker.com/products/docker-desktop/)).

---

## ⚡ 2. Instalación Rápida (1 Clic)

1. Abre el explorador de Windows y navega hasta la carpeta `instalacion\windows\`.
2. Haz doble clic en:
   ```cmd
   install_windows.bat
   ```
3. El instalador realizará automáticamente:
   - Instalación de dependencias de Python desde `requirements.txt`.
   - Inicialización de la base de datos local y tablas maestras (`database/init_db.py`).
   - Instalación de módulos Node.js y compilación del bundle de producción (`npm run build`).

---

## 🚀 3. Ejecución del Sistema

### Opción A: Ejecución Nativa Completa (Recomendada)
Haz doble clic en:
```cmd
run_windows.bat
```
* Abrirá automáticamente el servidor **Backend FastAPI en el puerto 8000** en una ventana de consola.
* Lanzará la **Terminal Kiosco de Electron** en su propia ventana táctil.

> **Atajos de Teclado en la Terminal Kiosco:**
> - `F11`: Alternar entre Pantalla Completa y Modo Ventana.
> - `Esc`: Salir de Pantalla Completa.

---

### Opción B: Ejecución por Componentes Separados
Si prefieres iniciar cada servicio por separado:
* **Solo Backend API:** Doble clic en `run_backend.bat` (servidor en `http://127.0.0.1:8000`).
* **Solo Frontend Kiosco:** Doble clic en `run_frontend.bat` (ventana Electron).

---

### Opción C: Ejecución en Contenedores Docker
Si dispones de Docker Desktop:
```cmd
docker-run.bat
```
* Compilará y levantará la arquitectura multicontenedor (MySQL, Backend FastAPI y Frontend Nginx).
* Abrirá el navegador en `http://localhost:5173`.
* Para detener los contenedores: abre una terminal en `instalacion` y ejecuta `docker compose down`.

---

## 🔑 4. Credenciales de Acceso Verificadas

### Modo Terminal de Autoservicio (Usuario):
* **Tarjeta:** `1234-5678-1234-5678` (o clic en el botón rápido *Carlos Gómez*)
* **PIN:** `1234`
* **Token:** `456789` (o clic en el botón verde *"Usar Token"*)

### Modo Consola Bancaria (Administrador):
* **Selector superior:** Cambiar a *"Panel Administrador"*
* **Tarjeta:** `9999-8888-7777-6666` (o botón rápido *Admin Bóveda*)
* **PIN:** `1234`
* **Token:** `123456`

---

## 🛠️ 5. Preguntas Frecuentes y Solución de Problemas

* **Error: 'python' no se reconoce como un comando interno o externo:**
  Reinstala Python asegurándote de marcar la casilla *"Add Python to PATH"*.
* **Error de puerto serie (COM3):**
  Si no tienes un Arduino Mega físico conectado, el sistema opera automáticamente con `MOCK_HARDWARE=true` definido en `.env`, simulando dispensación y sensores sin requerir hardware.
