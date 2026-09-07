# Módulo de Sensores, Controladores y Firmware Embebido (Sensors Module)

## 1. Visión General del Subsistema de Hardware
El módulo `sensors/` contiene la lógica de interacción con el mundo físico del Cajero Automático Embebido. Su arquitectura desacopla el microcontrolador de tiempo real del Gateway Backend:

1. **Microcontrolador Central (Arduino Mega 2560):** Gestiona la cinemática de los 7 dispensadores de billetes (motores paso a paso NEMA 17 con controladores A4988) y los 7 sensores ópticos infrarrojos de ranura (detección de paso y prevención de atascos).
2. **Módulo de Visión y Proximidad (ESP32-CAM + HC-SR04):** Captura fotográfica de auditoría mediante cámara OV2640 y detección ultrasónica de presencia de usuario frente al kiosco.
3. **Drivers y Emuladores en Python (`sensors/drivers/`):** Capa de abstracción que expone métodos asíncronos (`dispense()`, `capture_transaction_photo()`) al backend. Si no detecta puerto COM físico, entra automáticamente en modo emulación de alta fidelidad sin interrumpir el sistema.

---

## 2. Mapa de Pines e Interfaces Físicas
### Arduino Mega 2560 & Drivers A4988 (Dispensadores de Billetes)
Cada una de las 7 denominaciones oficiales cuenta con un par de pines `STEP` / `DIR` y una entrada digital para el sensor óptico IR:
- **Q200:** STEP D22 | DIR D23 | IR_SENSOR D38
- **Q100:** STEP D24 | DIR D25 | IR_SENSOR D39
- **Q50:**  STEP D26 | DIR D27 | IR_SENSOR D40
- **Q20:**  STEP D28 | DIR D29 | IR_SENSOR D41
- **Q10:**  STEP D30 | DIR D31 | IR_SENSOR D42
- **Q5:**   STEP D32 | DIR D33 | IR_SENSOR D43
- **Q1:**   STEP D34 | DIR D35 | IR_SENSOR D44
- **ENABLE Global:** Pin D8 (Active LOW)

### ESP32-CAM & Sensor Ultrasónico HC-SR04
- **HC-SR04 Trigger:** GPIO 12
- **HC-SR04 Echo:** GPIO 13
- **Cámara OV2640:** Bus SCCB / DVP embebido en la placa AI-Thinker.

---

## 3. Protocolo Serial JSON (115200 Baudios)
La comunicación se realiza por tramas JSON terminadas en salto de línea (`\n`).

### Comando de Dispensación (Host -> Arduino):
```json
{
  "cmd": "DISPENSE",
  "bills": {
    "200": 0,
    "100": 2,
    "50": 1,
    "20": 0,
    "10": 1,
    "5": 0,
    "1": 0
  }
}
```

### Respuesta de Éxito (Arduino -> Host):
```json
{
  "status": "SUCCESS",
  "dispensed": 260
}
```

### Respuesta de Error / Atasco (Arduino -> Host):
```json
{
  "status": "ERROR",
  "code": "JAM_DETECTED",
  "dispensed": 0
}
```

---

## 4. Guía de Pruebas y Emulación
Para verificar el controlador sin hardware conectado:
```bash
python -c "import asyncio; from sensors.drivers.serial_controller import serial_controller; print(asyncio.run(serial_controller.dispense({'100': 1, '50': 1})))"
```
Salida esperada:
`{'status': 'SUCCESS', 'dispensed': 150}`

---

## 5. Estrategia Multiagente GitFlow
Para evitar bloqueos o desincronizaciones con el software bancario principal, todo desarrollo en hardware, calibración de timers o cambio de pines debe realizarse en su rama dedicada:

- **Rama Asignada:** `feature/sensors-firmware`
- **Reglas de Aislamiento:**
  1. No realizar commits directos en `main`.
  2. Todo cambio en el protocolo JSON debe ser retrocompatible y no romper la interfaz de `dispense()`.
  3. Probar siempre el modo emulador (`mock_mode`) para asegurar que el backend y frontend puedan seguir corriendo pruebas unitarias sin hardware conectado.
  4. Mantener la suite de tests de hardware pasando antes de solicitar PR hacia `main`.
