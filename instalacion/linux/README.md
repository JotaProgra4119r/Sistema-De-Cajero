# Guía de Instalación y Ejecución en Linux (Debian / Ubuntu / Linux Mint)

### Sistema Bancario y Cajero Automático Embebido (ATM Kiosk)

Esta carpeta contiene todos los scripts, utilidades y componentes dedicados para instalar, compilar y ejecutar el sistema en distribuciones **Linux basadas en Debian/Ubuntu**.

---

## 📋 1. Requisitos Previos

En Linux Debian / Ubuntu, el instalador automático gestionará los paquetes necesarios vía `apt`. Solo asegúrate de contar con permisos de `sudo`:

* Python 3 (3.10+) con soporte para entornos virtuales (`python3-venv`).
* Node.js (18+) y gestor de paquetes `npm`.
* Navegador Chromium o Google Chrome (para modo Kiosco de pantalla completa si Electron no está disponible).
* *(Opcional para modo contenedores)* Docker y Docker Compose plugin.

---

## ⚡ 2. Instalación Rápida Paso a Paso

1. Abre una terminal y navega hasta esta carpeta:
   ```bash
   cd instalacion/linux
   ```
2. Otorga permisos de ejecución a los scripts:
   ```bash
   chmod +x *.sh
   ```
3. Ejecuta el instalador automatizado:
   ```bash
   ./install_linux.sh
   ```

### ¿Qué realiza el instalador automáticamente?
* **[1/4]** Instala librerías del sistema y dependencias de compilación (`python3-venv`, `nodejs`, `npm`, `chromium`, `curl`, `gcc`).
* **[2/4]** Crea y activa el entorno virtual aislado (`venv`) e instala las dependencias de Python desde `requirements.txt` (incluyendo `pydantic-settings`).
* **[3/4]** Inicializa la base de datos relacional local (`atm_system.db`) con usuarios semilla y stock de bóveda.
* **[4/4]** Instala módulos de Node.js (`npm install --include=dev`) y genera el bundle de producción optimizado en `frontend/dist/index.html`.

---

## 🚀 3. Modos de Ejecución

### Opción A: Ejecución Nativa con Terminal Kiosco (Recomendada)
Ejecuta directamente:
```bash
./run_linux.sh
```
* **Auto-reparación integrada:** Si por alguna razón la carpeta `frontend/dist/` fue limpiada, el script la compila automáticamente antes de abrir la interfaz.
* **Redundancia visual:** Inicia Electron nativo si está presente; si no, levanta un servidor estático en el puerto 5173 e inicia Chromium/Chrome en modo Kiosco (`--kiosk`).

### Opción B: Doble Clic en Entorno Gráfico (.desktop)
Puedes hacer doble clic sobre el archivo `Cajero.desktop` desde tu gestor de archivos (Nautilus, Dolphin, Thunar).
> *Nota:* Si tu entorno gráfico solicita confirmación, selecciona *"Permitir ejecución"* o clic derecho -> *"Ejecutar como un programa"*.

### Opción C: Ejecución en Contenedores Docker
Si tienes Docker instalado:
```bash
./docker-run.sh
```
Para detener el stack de contenedores:
```bash
cd ..
docker compose down
```

---

## 🔑 4. Credenciales de Acceso Verificadas

### Terminal de Usuario (Kiosco):
* **Tarjeta:** `1234-5678-1234-5678` (o clic en el botón rápido *Carlos Gómez*)
* **PIN:** `1234`
* **Token:** `456789` (o clic en el botón verde *"Usar Token"*)

### Consola de Administrador (Bóveda y Auditoría):
* **Selector superior:** Cambiar a *"Panel Administrador"*
* **Tarjeta:** `9999-8888-7777-6666` (o botón rápido *Admin Bóveda*)
* **PIN:** `1234`
* **Token:** `123456`

---

## 🛠️ 5. Solución de Problemas Comunes en Linux

1. **Error: `ERR_CONNECTION_REFUSED` en http://localhost:5173:**
   Este error ocurre si `frontend/dist/index.html` no fue compilado. El script `run_linux.sh` actual lo repara automáticamente, pero también puedes forzarlo manualmente con:
   ```bash
   cd ../../frontend && npm install --include=dev && npm run build
   ```
2. **Error al abrir scripts con doble clic (se abre el editor de texto):**
   Es la política de seguridad por defecto de GNOME/KDE. Ejecuta desde la terminal con `./run_linux.sh` o usa `Cajero.desktop`.
3. **Repositorios de APT bloqueados por llaves GPG expiradas (ej. Spotify):**
   Si `sudo apt update` falla por claves expiradas de terceros, refresca la llave o elimina el repositorio en conflicto dentro de `/etc/apt/sources.list.d/`.
