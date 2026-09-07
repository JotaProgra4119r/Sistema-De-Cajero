# Módulo de Sensores, Controladores y Firmware Embebido (`sensors/`)

## 1. Propósito e Importancia Crítica en el Sistema
El módulo `sensors/` gobierna la capa física, mecánica y de tiempo real del Cajero Automático Embebido. Implementa el control cinemático de los dispensadores de billetes, la supervisión óptica de paso para prevención de atascos y la telemetría sensorial de seguridad (visión artificial y proximidad).

### ¿Por qué es crítico?
- **Despacho Físico Concurrente de Billetes:** Gobierna los 7 motores paso a paso NEMA 17 (un motor independiente para cada una de las denominaciones en Quetzales: Q200, Q100, Q50, Q20, Q10, Q5 y Q1) mediante controladores A4988 coordinados por un **Arduino Mega 2560**.
- **Detección Inmediata de Atascos (Jam Detection):** 7 sensores ópticos infrarrojos de ranura verifican el paso efectivo de cada billete eyectado. Si un billete se encalla o la ranura permanece obstruida por más de 500 ms, el firmware aborta el ciclo de inmediato, emite un error serial estructurado y previene daños mecánicos o descuadres de efectivo en bóveda.
- **Auditoría Fotográfica y Telemetría de Proximidad:** Un módulo **ESP32-CAM** con cámara OV2640 y un sensor ultrasónico HC-SR04 capturan una fotografía de seguridad por cada transacción realizada y verifican que el usuario esté presente frente al kiosco a una distancia operativa menor a 100 cm.
- **Emulador Integrado de Alta Fidelidad:** En entornos de prueba o desarrollo sin hardware físico conectado, los drivers de Python entran automáticamente en modo emulación sin bloquear el flujo transaccional.

---

## 2. Estructura de Archivos y Responsabilidad de Componentes

```
sensors/
├── drivers/
│   ├── __init__.py              # Exportador unificado de los controladores de hardware.
│   ├── serial_controller.py     # Controlador de comunicación RS-232 / USB a 115200 baudios y emulador de dispensación.
│   └── esp32_controller.py      # Controlador de telemetría de presencia ultrasónica y captura de fotos OV2640.
├── firmware/
│   ├── arduino_mega/
│   │   └── arduino_mega.ino     # Firmware C++ para Arduino Mega 2560: control cinemático de 7 motores A4988 y sensores IR.
│   └── esp32_cam/
│       └── esp32_cam.ino        # Firmware C++ para ESP32-CAM: servidor HTTP de streaming de video y sensor HC-SR04.
├── __init__.py                  # Punto de entrada del módulo sensors.
└── README.md                    # Especificación técnica, mapa de pines y directrices de desarrollo.
```

---

## 3. Mapa de Pines e Interfaces Eléctricas

### Arduino Mega 2560 & Controladores A4988 (Dispensadores de Billetes)
Cada cartucho de billetes está compuesto por un driver paso a paso A4988 (1/16 micropasos) y un sensor infrarrojo de herradura:

| Denominación | Pin STEP (Paso) | Pin DIR (Sentido) | Pin IR Sensor (Entrada Digital) | Cartucho Asignado |
| :---: | :---: | :---: | :---: | :--- |
| **Q200** | Pin D22 | Pin D23 | Pin D38 | Bandeja 1 (Superior) |
| **Q100** | Pin D24 | Pin D25 | Pin D39 | Bandeja 2 |
| **Q50**  | Pin D26 | Pin D27 | Pin D40 | Bandeja 3 |
| **Q20**  | Pin D28 | Pin D29 | Pin D41 | Bandeja 4 |
| **Q10**  | Pin D30 | Pin D31 | Pin D42 | Bandeja 5 |
| **Q5**   | Pin D32 | Pin D33 | Pin D43 | Bandeja 6 |
| **Q1**   | Pin D34 | Pin D35 | Pin D44 | Bandeja 7 (Inferior) |
| **ENABLE Global** | Pin D8 | — | — | Habilitación de drivers (Activo en BAJO) |

### ESP32-CAM & Sensor Ultrasónico HC-SR04
- **HC-SR04 Trigger:** GPIO 12 (Pulso de 10µs para disparo sónico).
- **HC-SR04 Echo:** GPIO 13 (Medición de eco con divisor resistivo a 3.3V).
- **Cámara OV2640:** Bus paralelo SCCB/DVP en placa AI-Thinker con resolución SVGA (800x600) para capturas de auditoría.

---

## 4. Protocolo de Comunicación Serial JSON (115200 Baudios)

La comunicación entre el Gateway (`backend/`) y el Arduino Mega se realiza mediante tramas JSON terminadas en salto de línea (`\n`):

### 4.1 Comando de Dispensación (Host -> Arduino):
```json
{
  "cmd": "DISPENSE",
  "bills": {
    "200": 0,
    "100": 1,
    "50": 0,
    "20": 1,
    "10": 0,
    "5": 0,
    "1": 3
  }
}
```

### 4.2 Respuesta Exitosa (Arduino -> Host):
```json
{
  "status": "SUCCESS",
  "dispensed": 123
}
```

### 4.3 Respuesta de Falla Mecánica / Atasco (Arduino -> Host):
```json
{
  "status": "ERROR",
  "code": "JAM_DETECTED",
  "dispensed": 0
}
```

---

## 5. Guía Operativa de Pruebas y Emulación

### Probar el Controlador y Emulador en Python:
```bash
python -c "import asyncio; from sensors.drivers.serial_controller import serial_controller; print(asyncio.run(serial_controller.dispense({'100': 1, '20': 1, '1': 3})))"
```
Salida esperada en modo emulación:
`{'status': 'SUCCESS', 'dispensed': 123}`

### Simular un Atasco Físico para Pruebas de Reversión Contable:
```bash
python -c "import asyncio; from sensors.drivers.serial_controller import serial_controller; serial_controller.set_simulate_jam(True); print(asyncio.run(serial_controller.dispense({'100': 1})))"
```
Salida esperada:
`{'status': 'ERROR', 'code': 'JAM_DETECTED', 'dispensed': 0}`

### Cargar Firmware en Arduino Mega:
1. Abrir `sensors/firmware/arduino_mega/arduino_mega.ino` en Arduino IDE.
2. Seleccionar placa: **Arduino Mega or Mega 2560** (Procesador ATmega2560).
3. Compilar y flashear al puerto asignado (ej. `COM3` en Windows).

---

## 6. Directrices para el Agente de IA (`feature/sensors-firmware`)

- **Rama Exclusiva:** `feature/sensors-firmware` (prohibido hacer push directo a `main`).
- **Tolerancia a Ausencia de Hardware:** El driver `serial_controller.py` debe ser siempre capaz de inicializarse en modo mock sin lanzar excepciones fatales si el puerto COM no está conectado.
- **Inviolabilidad de la Firma del Protocolo:** Si se añaden comandos al protocolo JSON (ej. `STATUS`, `CALIBRATE`), la estructura del comando `DISPENSE` y sus respuestas de retorno (`SUCCESS` / `ERROR`) debe mantenerse retrocompatible con el backend.
- **Timing Seguro de Motores:** En código Arduino, respetar los tiempos mínimos de conmutación de los micropasos (mínimo 1000 µs por semi-ciclo) para evitar pérdida de pasos por inercia mecánica.
