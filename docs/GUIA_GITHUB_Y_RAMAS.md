# Guía de Arquitectura de Ramas y Flujo de Trabajo en GitHub
### Sistema Bancario y Cajero Automático Embebido (ATM Kiosk)

Esta guía documenta la estructura de control de versiones, el propósito de cada rama y el protocolo estricto que deben seguir todos los desarrolladores y agentes de inteligencia artificial para contribuir al proyecto sin romper el nodo principal (main).

---

## 1. Filosofía de Trabajo y Visión General

El repositorio utiliza un modelo **GitFlow Modular Escalable** adaptado a desarrollo concurrente multiagente.  

El objetivo fundamental es **aislar el código en producción de cualquier cambio en desarrollo**, garantizando que:
1. El nodo principal (main) siempre sea ejecutable, estable y libre de errores.
2. Los desarrolladores y agentes puedan trabajar simultáneamente en diferentes capas (Frontend, Backend, Firmware, Base de Datos, IA) sin pisarse el código ni generar conflictos de merge.
3. Todo cambio deba superar una batería automatizada de validaciones antes de poder integrarse.

`
                    TAG v1.0.0-release
main ----------------------------------------*-------------------------- (PRODUCCIÓN PROTEGIDA)
       \                                    / ^ (Pull Request Validado)
develop --------*-----------------*--------*----------------------------- (INTEGRACIÓN CONTINUA)
          \     /                 /        /
feature/   *---* (frontend)       /        /
feature/         *---------------* (core) /
feature/                     *-----------* (firmware / hardware / dualwrite)
`

---

## 2. Mapa Detallado de Ramas (Espacios de Trabajo)

El repositorio cuenta con dos ramas troncales y cinco ramas de dominio modular:

### 🌟 Ramas Troncales

| Rama | Tipo | Propósito y Reglas de Uso |
| :--- | :--- | :--- |
| **main** | **Producción** | **Nodo Principal Protegido.** Aloja el software listo para despliegue en terminales físicas de cajero. Solo recibe código mediante Pull Requests probados desde develop. **Prohibido realizar commits o push directos.** |
| **develop** | **Integración** | **Espacio de Integración.** Es la rama base donde convergen los módulos desarrollados por los distintos equipos y agentes antes de publicar un release. |

---

### 🚀 Ramas de Característica por Dominio (eature/*)

Cada rama representa un subsistema técnico aislado:

| Rama | Subsistema / Capa | Tecnologías Clave | ¿Qué se trabaja aquí? |
| :--- | :--- | :--- | :--- |
| **eature/frontend-kiosk** | Interfaz de Usuario y Kiosco | React 18, TypeScript, Tailwind CSS, Electron, Vite | Pantallas táctiles, microinteracciones Discord, selector de billetes, WindowBar, empaquetado de escritorio y optimización para kiosco. |
| **eature/backend-core** | Núcleo Transaccional | Python 3.14, FastAPI, WebSockets, PyJWT, TOTP | Reglas bancarias, validación de retiros arbitrarios, endpoints REST, seguridad MFA, auditoría en vivo y control de cuotas. |
| **eature/firmware-hardware** | Hardware Embebido e IoT | Arduino Mega 2560 (C++), ESP32-CAM, RS-232 | Control de 7 motores paso a paso A4988, sensores de ranura IR, protocolo JSON serial, telemetría ultrasónica HC-SR04 y cámara OV2640. |
| **eature/storage-dualwrite** | Persistencia y Datos | MySQL 8.4 InnoDB, SQLite, AsyncIO Lock, TXT | Dual-write concurrente, modelos SQLAlchemy, DDL relacional y sincronización atómica con los archivos planos delimitados por plecas (.txt). |
| **eature/multiagent-graphify** | Análisis Multiagente e IA | Graphify, Tree-sitter AST, Algoritmo de Leiden | Generación determinista del grafo de dependencias de código, detección de God Nodes y transferencia de contexto con ahorro de tokens. |

---

## 3. Protocolo Paso a Paso para Desarrollar y Subir Cambios

### Paso 1: Clonar y Sincronizar el Repositorio
`ash
git clone https://github.com/JotaProgra4119r/Sistema-De-Cajero.git
cd Sistema-De-Cajero
git fetch --all
`

### Paso 2: Crear tu Rama de Trabajo
Nunca trabajes directamente sobre main ni develop. Crea una rama con prefijo descriptivo a partir de develop:

`ash
# Cambiar a develop y actualizarla
git checkout develop
git pull origin develop

# Crear tu rama de trabajo
git checkout -b feature/nombre-de-tu-mejora
`
*Ejemplos válidos de nombres de rama:*
* eature/lector-huella-digital
* eature/ajuste-estilos-teclado
* ix/timeout-inactividad
* efactor/serial-buffer-overflow

---

### Paso 3: Realizar Cambios y Validar Localmente
Antes de guardar o subir cualquier cambio, **es obligatorio ejecutar las pruebas automáticas y la compilación**:

1. **Validar Backend (Python):**
   `ash
   pytest backend/tests/ -v
   `
   *Criterio de aceptación:* Todos los tests deben terminar en verde (PASSED).

2. **Validar Frontend (TypeScript / React):**
   `ash
   cd frontend
   npm run build
   `
   *Criterio de aceptación:* 0 errores de tipado o compilación Vite.

---

### Paso 4: Realizar Commits Convencionales
Usa mensajes de commit claros siguiendo el estándar [Conventional Commits](https://www.conventionalcommits.org/):

* eat(front): agregar confirmación táctil con sonido en teclado
* ix(core): corregir cálculo de remanente en bóveda para Q5
* docs(readme): actualizar instrucciones de ejecución
* efactor(firmware): optimizar interrupción del sensor IR de ranura

`ash
git add .
git commit -m feat(modulo): descripción clara y concisa
`

---

### Paso 5: Subir tu Rama a GitHub
`ash
git push -u origin feature/nombre-de-tu-mejora
`

---

### Paso 6: Abrir un Pull Request (PR)
1. Ingresa al repositorio en GitHub: [https://github.com/JotaProgra4119r/Sistema-De-Cajero](https://github.com/JotaProgra4119r/Sistema-De-Cajero)
2. Haz clic en **Compare & pull request**.
3. **Rama base:** Selecciona siempre ase: develop (NO main).
4. **Rama comparada:** Selecciona compare: feature/nombre-de-tu-mejora.
5. Describe brevemente los cambios realizados y los componentes afectados.

---

## 4. Protección Automatizada mediante CI/CD (GitHub Actions)

El repositorio cuenta con un pipeline de Integración Continua configurado en [.github/workflows/ci.yml](file:///.github/workflows/ci.yml).

Cada vez que alguien realiza un push o abre un Pull Request hacia develop o main, GitHub ejecuta automáticamente en contenedores aislados:
1. **Job ackend-validation:**
   * Levanta Python 3.12.
   * Instala dependencias del backend.
   * Ejecuta la suite de pruebas unitarias (pytest backend/tests/ -v).
2. **Job rontend-validation:**
   * Levanta Node.js 20.
   * Instala paquetes vía 
pm ci.
   * Ejecuta el compilador de TypeScript (	sc -b) y el empaquetador de producción (ite build).

> [!IMPORTANT]
> Si cualquiera de estas validaciones falla en GitHub Actions, **el Pull Request quedará bloqueado** y no se permitirá su integración, protegiendo así la integridad del sistema.

---

## 5. Reglas de Oro para Mantener el Proyecto Sano

1. 🚫 **NUNCA hagas git push --force sobre main o develop:** Esto sobreescribiría la historia compartida de los demás integrantes del equipo.
2. 🚫 **NUNCA subas secretos:** Las credenciales de base de datos de producción, tokens privados o llaves de API deben ir en .env (el cual está protegido en .gitignore).
3. ✅ **Mantén tus ramas actualizadas:** Antes de finalizar tu trabajo, haz git pull origin develop dentro de tu rama para resolver posibles conflictos con anticipación.
4. ✅ **Respeta la arquitectura Dual-Write:** Cualquier nueva entidad de datos debe reflejarse tanto en la base de datos relacional como en los archivos de texto correspondientes en ./data/storage_txt/.

---

## 6. Manejo de Versiones Semánticas (Tags)

El proyecto utiliza versionado semántico formal (MAJOR.MINOR.PATCH):

| Etiqueta | Estado de Entrega | Hito Cumplido |
| :--- | :--- | :--- |
| **0.1.0-alpha** | Alpha | Modelo de datos MySQL, SQLite y estructura dual-write TXT. |
| **0.5.0-beta** | Beta | Motor transaccional FastAPI, WebSockets y vistas táctiles en React. |
| **0.9.0-rc** | Release Candidate | Firmware Arduino Mega/ESP32, empaquetado Electron y hardware emulator. |
| **1.0.0-release** | Release Oficial | Producción completa, suite CI/CD, Graphify AST y correcciones de UI. |

### Cómo etiquetar una nueva versión en producción:
`ash
# Desde la rama main estable:
git checkout main
git pull origin main
git tag -a v1.1.0 -m Release v1.1.0: Descripción de las nuevas funciones
git push origin v1.1.0
`

---

## 7. Resumen de Comandos Rápidos (Cheat Sheet)

`ash
# Ver en qué rama estás actualmente
git branch

# Ver el estado de tus archivos modificados
git status

# Traer los últimos cambios del servidor remoto
git pull origin develop

# Crear y cambiarte a una nueva rama
git checkout -b feature/nueva-funcion

# Guardar cambios
git add .
git commit -m feat(modulo): mensaje claro

# Subir tu rama a GitHub
git push -u origin feature/nueva-funcion

# Ver historial limpio de commits
git log --oneline --graph --decorate
`