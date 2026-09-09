# 📦 Módulo y Scripts de Instalación y Despliegue

Esta carpeta centraliza todos los scripts de empaquetado, instalación nativa y orquestación con Docker organizados por sistema operativo para **Windows 10/11** y **Linux Debian / Ubuntu**.

---

## 📂 Organización por Plataforma

Para facilitar la experiencia de usuario y desarrollador, los scripts y guías están organizados en dos subcarpetas especializadas:

### 🪟 1. [Entorno Windows (`instalacion/windows/`)](file:///c:/Users/majop/Documents/Cajero%20Inzano%20prueba%20sexo%20duro%20aver%20que%20sale%20agentes%20de%20ia%20para%20trabajar/instalacion/windows)
Contiene la suite completa para Windows con instalador de 1 clic, lanzadores y manual:
* **`README.md`**: [Guía completa de instalación y solución de problemas en Windows](file:///c:/Users/majop/Documents/Cajero%20Inzano%20prueba%20sexo%20duro%20aver%20que%20sale%20agentes%20de%20ia%20para%20trabajar/instalacion/windows/README.md).
* **`install_windows.bat`**: Instalador de dependencias (`pip` + `npm` + inicialización de base de datos).
* **`run_windows.bat`**: Lanzador principal del sistema (Backend FastAPI + Kiosco Electron).
* **`run_backend.bat`**: Ejecutor aislado del Backend Core en consola.
* **`run_frontend.bat`**: Ejecutor aislado de la ventana de Kiosco Electron.
* **`docker-run.bat`**: Lanzador automatizado para Docker Desktop.

### 🐧 2. [Entorno Linux (`instalacion/linux/`)](file:///c:/Users/majop/Documents/Cajero%20Inzano%20prueba%20sexo%20duro%20aver%20que%20sale%20agentes%20de%20ia%20para%20trabajar/instalacion/linux)
Contiene la suite completa para Linux Debian, Ubuntu y derivados:
* **`README.md`**: [Guía completa paso a paso para Linux Debian / Ubuntu](file:///c:/Users/majop/Documents/Cajero%20Inzano%20prueba%20sexo%20duro%20aver%20que%20sale%20agentes%20de%20ia%20para%20trabajar/instalacion/linux/README.md).
* **`install_linux.sh`**: Instalador automatizado con gestión de paquetes `apt`, entorno virtual `venv` y compilación de producción.
* **`run_linux.sh`**: Lanzador con auto-reparación (compila frontend si falta y ofrece fallback a Chromium/Chrome con servidor estático).
* **`Cajero.desktop`**: Lanzador de escritorio para ejecutar el cajero con doble clic en GNOME/KDE/XFCE.
* **`docker-run.sh`**: Lanzador del stack de contenedores Docker en Linux.

---

## 🐳 Contenedores y Configuración Base (Raíz de `instalacion/`)

* **`docker-compose.yml`**: Orquestación de servicios Backend (FastAPI) y Frontend (Nginx).
* **`Dockerfile`**, **`Dockerfile.backend`**, **`Dockerfile.frontend`**: Imágenes para despliegues contenerizados.
* **`nginx.conf`**: Configuración de reverse proxy para API REST y WebSockets en producción.
