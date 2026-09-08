# 📦 Módulo y Scripts de Instalación y Despliegue

Esta carpeta centraliza todos los scripts de empaquetado, instalación nativa y orquestación con Docker para **Windows** y **Linux Debian**.

---

## 📂 Contenido del Directorio

| Archivo | Plataforma | Propósito |
| :--- | :--- | :--- |
| `docker-compose.yml` | Multiplataforma | Orquestación completa de Backend (FastAPI) y Frontend (Nginx). |
| `docker-run.bat` | Windows | Lanzador con 1 solo clic en Windows (Docker Desktop). |
| `docker-run.sh` | Linux Debian | Lanzador con 1 solo clic en Debian / Ubuntu (Modo Kiosco). |
| `Dockerfile` | Debian Bookworm | Imagen todo-en-uno con Nginx + Uvicorn vía `supervisord`. |
| `Dockerfile.backend` | Debian Bookworm | Imagen individual del Core Transaccional Python 3.12. |
| `Dockerfile.frontend` | Alpine / Bookworm | Compilación multi-stage React 18 + Nginx reverse proxy. |
| `nginx.conf` | Multiplataforma | Proxy inverso para redirigir `/api/` y WebSockets `/ws/`. |
| `install_windows.bat` | Windows | Instalador nativo de dependencias (Python + Node.js). |
| `run_windows.bat` | Windows | Lanzador nativo de Backend + Electron Kiosk en Windows. |
| `install_debian.sh` | Linux Debian | Instalador nativo de dependencias (`apt` + `venv` + `npm`). |
| `run_debian.sh` | Linux Debian | Lanzador nativo de Backend + Kiosco táctil en Debian. |
| `run_backend.bat` | Windows | Lanzador individual de Backend para desarrollo. |
| `run_frontend.bat` | Windows | Lanzador individual de Frontend para desarrollo. |

---

## 🚀 Uso Rápido

### Modalidad Docker ("Solo Instalar y Abrir")
* **Windows:** Doble clic en `instalacion/docker-run.bat`.
* **Linux Debian:** `./instalacion/docker-run.sh`.

### Modalidad Nativa
* **Windows:** Ejecutar `instalacion/install_windows.bat` (1 vez) y luego `instalacion/run_windows.bat`.
* **Linux Debian:** Ejecutar `./instalacion/install_debian.sh` (1 vez) y luego `./instalacion/run_debian.sh`.
