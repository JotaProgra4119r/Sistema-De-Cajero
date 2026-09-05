/*
 * ==============================================================================
 * SISTEMA BANCARIO CAJERO AUTOMÁTICO EMBEBIDO
 * Firmware de Control de Dispensación Física y Sensores de Conteo
 * Plataforma: Arduino Mega 2560 (ATmega2560)
 * Comunicación: USB-Serial a 115200 Baudios
 * ==============================================================================
 * Controla siete (7) motores paso a paso con drivers A4988 y siete (7)
 * sensores ópticos infrarrojos de ranura (IR) para verificar la eyección
 * de cada billete de las denominaciones en Quetzales:
 * Q200, Q100, Q50, Q20, Q10, Q5, Q1.
 * ==============================================================================
 */

#include <Arduino.h>

// Definición de pines para 7 Drivers A4988 (STEP, DIR)
// Cartucho 0: Q200
#define STEP_PIN_200 22
#define DIR_PIN_200  23
#define SENSOR_IR_200 2

// Cartucho 1: Q100
#define STEP_PIN_100 24
#define DIR_PIN_100  25
#define SENSOR_IR_100 3

// Cartucho 2: Q50
#define STEP_PIN_50  26
#define DIR_PIN_50   27
#define SENSOR_IR_50  18

// Cartucho 3: Q20
#define STEP_PIN_20  28
#define DIR_PIN_20   29
#define SENSOR_IR_20  19

// Cartucho 4: Q10
#define STEP_PIN_10  30
#define DIR_PIN_10   31
#define SENSOR_IR_10  20

// Cartucho 5: Q5
#define STEP_PIN_5   32
#define DIR_PIN_5   33
#define SENSOR_IR_5   21

// Cartucho 6: Q1
#define STEP_PIN_1   34
#define DIR_PIN_1   35
#define SENSOR_IR_1   4

#define ENABLE_PIN_ALL 38 // Pin de habilitación común para los 7 drivers
#define STEPS_PER_BILL 200 // Pasos de rotación para extraer exactamente un billete
#define STEP_DELAY_MICROS 800
#define SENSOR_TIMEOUT_MS 3000 // Tiempo máximo para que el sensor detecte el paso del papel

struct DenomDriver {
  int denom;
  int stepPin;
  int dirPin;
  int sensorPin;
};

const DenomDriver DRIVERS[7] = {
  {200, STEP_PIN_200, DIR_PIN_200, SENSOR_IR_200},
  {100, STEP_PIN_100, DIR_PIN_100, SENSOR_IR_100},
  {50,  STEP_PIN_50,  DIR_PIN_50,  SENSOR_IR_50},
  {20,  STEP_PIN_20,  DIR_PIN_20,  SENSOR_IR_20},
  {10,  STEP_PIN_10,  DIR_PIN_10,  SENSOR_IR_10},
  {5,   STEP_PIN_5,   DIR_PIN_5,   SENSOR_IR_5},
  {1,   STEP_PIN_1,   DIR_PIN_1,   SENSOR_IR_1}
};

void setup() {
  Serial.begin(115200);
  while (!Serial) { ; }

  pinMode(ENABLE_PIN_ALL, OUTPUT);
  digitalWrite(ENABLE_PIN_ALL, HIGH); // Motores deshabilitados por defecto

  for (int i = 0; i < 7; i++) {
    pinMode(DRIVERS[i].stepPin, OUTPUT);
    pinMode(DRIVERS[i].dirPin, OUTPUT);
    pinMode(DRIVERS[i].sensorPin, INPUT_PULLUP);
    digitalWrite(DRIVERS[i].dirPin, HIGH); // Sentido de tracción hacia salida
  }

  Serial.println(F("{\"status\":\"READY\",\"firmware\":\"ATM_MEGA_DISPENSER_v1.0\"}"));
}

bool dispenseSingleBill(int driverIndex) {
  int stepPin = DRIVERS[driverIndex].stepPin;
  int sensorPin = DRIVERS[driverIndex].sensorPin;

  // Girar motor paso a paso
  for (int s = 0; s < STEPS_PER_BILL; s++) {
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(STEP_DELAY_MICROS);
    digitalWrite(stepPin, LOW);
    delayMicroseconds(STEP_DELAY_MICROS);
  }

  // Verificar paso por sensor óptico IR
  unsigned long start = millis();
  bool detected = false;
  while (millis() - start < SENSOR_TIMEOUT_MS) {
    if (digitalRead(sensorPin) == LOW) { // Haz interrumpido por el papel moneda
      detected = true;
      break;
    }
    delay(5);
  }

  return detected;
}

void parseAndExecuteCommand(String json) {
  json.trim();
  if (!json.startsWith("{") || !json.endsWith("}")) {
    Serial.println(F("{\"status\":\"ERROR\",\"code\":\"INVALID_JSON\",\"dispensed\":0}"));
    return;
  }

  // Búsqueda simple de comando DISPENSE
  if (json.indexOf("\"DISPENSE\"") == -1) {
    Serial.println(F("{\"status\":\"ERROR\",\"code\":\"UNKNOWN_COMMAND\",\"dispensed\":0}"));
    return;
  }

  digitalWrite(ENABLE_PIN_ALL, LOW); // Habilitar drivers de motores

  int billsToDispense[7] = {0, 0, 0, 0, 0, 0, 0};
  int totalDispensed = 0;

  // Extraer cantidades por denominación
  for (int i = 0; i < 7; i++) {
    String key = "\"" + String(DRIVERS[i].denom) + "\":";
    int idx = json.indexOf(key);
    if (idx != -1) {
      int startNum = idx + key.length();
      int endNum = json.indexOf(",", startNum);
      if (endNum == -1) endNum = json.indexOf("}", startNum);
      if (endNum != -1) {
        billsToDispense[i] = json.substring(startNum, endNum).toInt();
      }
    }
  }

  // Ejecutar dispensación secuencial con verificación de atasco
  bool jamOccurred = false;
  for (int i = 0; i < 7; i++) {
    int count = billsToDispense[i];
    for (int c = 0; c < count; c++) {
      bool success = dispenseSingleBill(i);
      if (!success) {
        jamOccurred = true;
        break;
      }
      totalDispensed += DRIVERS[i].denom;
      delay(150); // Pausa entre eyecciones sucesivas
    }
    if (jamOccurred) break;
  }

  digitalWrite(ENABLE_PIN_ALL, HIGH); // Deshabilitar motores

  if (jamOccurred) {
    Serial.print(F("{\"status\":\"ERROR\",\"code\":\"JAM_DETECTED\",\"dispensed\":"));
    Serial.print(totalDispensed);
    Serial.println(F("}"));
  } else {
    Serial.print(F("{\"status\":\"SUCCESS\",\"dispensed\":"));
    Serial.print(totalDispensed);
    Serial.println(F("}"));
  }
}

void loop() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    parseAndExecuteCommand(input);
  }
}
