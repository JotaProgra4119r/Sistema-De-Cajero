# Guía de Arquitectura de Ramas y Flujo de Trabajo en GitHub
### Sistema Bancario y Cajero Automático Embebido (ATM Kiosk)

Esta guía documenta la estructura de control de versiones, el propósito de cada rama y el protocolo estricto que deben seguir todos los desarrolladores y agentes de inteligencia artificial para contribuir al proyecto sin romper el nodo principal (`main`).

---

## 1. Filosofía de Trabajo y Visión General

El repositorio utiliza un modelo **GitFlow Modular de 4 Espacios de Trabajo** adaptado para desarrollo concurrente multiagente.

El objetivo fundamental es **aislar el código en producción de cualquier cambio en desarrollo**, garantizando que:
1. El nodo principal (`main`) siempre sea ejecutable, estable y libre de errores.
2. Los desarrolladores y agentes de IA trabajen exclusivamente dentro de su respectivo espacio de los **4 módulos del sistema**:
   - `frontend/`
   - `backend/`
   - `database/`
   - `sensors/`
3. Ningún agente interfiera con el trabajo de los otros ni comprometa la integridad del cajero físico.

```
                    TAG v1.0.2
main ----------------------------------------*-------------------------- (PRODUCCIÓN PROTEGIDA)
       \                                    / ^ (CI Validado: Pytest + Vite Build)
        +-- feature/frontend-kiosk --------+ (Agente Frontend / React / Electron / Temas)
        +-- feature/backend-core ----------+ (Agente Backend / API / TOTP Dinámico / Reglas)
        +-- feature/database-dualwrite ----+ (Agente Base de Datos / Dual-Write / Migraciones)
        +-- feature/sensors-firmware ------+ (Agente Sensores / Hardware / Firmware)
```

---

## 2. Los 4 Espacios de Trabajo Multiagente (Ramas Oficiales)

El repositorio cuenta con **1 rama principal** y **exactamente 4 ramas de trabajo**:

### 🌟 Rama Principal
| Rama | Tipo | Propósito y Reglas de Uso |
| :--- | :--- | :--- |
| **`main`** | **Producción** | **Nodo Principal Protegido.** Aloja el software listo para despliegue en terminales físicas de cajero. Solo recibe código mediante Pull Requests probados. **Prohibido realizar commits o push directos que no hayan superado las pruebas unitarias y de compilación.** |

---

### 🚀 Las 4 Ramas Modulares Multiagente
Cada rama representa un subsistema técnico aislado para su respectivo agente o equipo:

| # | Rama en GitHub | Subsistema / Módulo | Tecnologías Clave | Responsabilidad del Agente |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **`feature/frontend-kiosk`** | `frontend/` | React 18, TypeScript, Tailwind CSS, Electron, Vite | Pantallas táctiles, microinteracciones estilo Discord dark, selector de billetes, controles de ventana y empaquetado de escritorio para terminal de autoservicio. |
| **2** | **`feature/backend-core`** | `backend/` | Python 3.14, FastAPI, WebSockets, PyJWT, TOTP Anti-Replay | Reglas bancarias, validación de retiros arbitrarios, endpoints REST, seguridad MFA, auditoría en vivo y control de cuotas diarias. |
| **3** | **`feature/database-dualwrite`** | `database/` | MySQL 8.4 InnoDB, SQLite 3, AsyncIO Lock, TXT | Dual-write concurrente, modelos SQLAlchemy, DDL relacional, sistema de Soft Delete inmutable y sincronización con archivos planos delimitados por plecas (`.txt`). |
| **4** | **`feature/sensors-firmware`** | `sensors/` | Arduino Mega 2560 (C++), ESP32-CAM, RS-232 | Control de los 7 motores paso a paso A4988, sensores de ranura IR, protocolo JSON serial a 115200 baudios, sensor ultrasónico HC-SR04 y cámara OV2640. |

---

## 3. Protocolo Paso a Paso para Desarrollar y Subir Cambios

### Paso 1: Clonar y Sincronizar el Repositorio
```bash
git clone https://github.com/JotaProgra4119r/Sistema-De-Cajero.git
cd Sistema-De-Cajero
git fetch --all
```

### Paso 2: Cambiar a la Rama del Módulo Asignado
Nunca trabajes directamente sobre `main`. Posiciónate en la rama correspondiente a tu subsistema:

```bash
# Para agentes de Frontend:
git checkout feature/frontend-kiosk

# Para agentes de Backend:
git checkout feature/backend-core

# Para agentes de Base de Datos:
git checkout feature/database-dualwrite

# Para agentes de Sensores y Hardware:
git checkout feature/sensors-firmware
```

### Paso 3: Realizar Cambios y Validar Localmente
Antes de hacer commit, ejecuta las pruebas del subsistema:

```bash
# Para frontend:
cd frontend && npm run build

# Para backend y base de datos:
pytest backend/tests/ -v

# Para hardware:
python -c "from sensors.drivers.serial_controller import serial_controller; print(serial_controller.mock_mode)"
```

### Paso 4: Subir los Cambios a GitHub
```bash
git add .
git commit -m "feat(modulo): descripcion clara del cambio"
git push origin feature/nombre-de-tu-rama
```

### Paso 5: Abrir Pull Request hacia `main`
1. Ingresa a `https://github.com/JotaProgra4119r/Sistema-De-Cajero/pulls`.
2. Crea un Pull Request seleccionando como base `main` y como compare tu rama (`feature/*`).
3. Verifica que las pruebas automatizadas y la compilación pasen en verde.
4. Tras la revisión y aprobación, realiza el merge seguro hacia `main`.
