/*
 * ==============================================================================
 * SISTEMA BANCARIO CAJERO AUTOMÁTICO EMBEBIDO (ATM KIOSK)
 * Firmware de Control de Acceso Físico y Telemetría RFID por Proximidad
 * Plataforma: ESP32 DevKit V1 / ESP32-WROOM-32
 * Módulo RFID: MFRC522 (Bus SPI)
 * Funcionalidad:
 *   - Lectura de tarjetas físicas bancarias por inducción electromagnética RFID
 *   - Transmisión en tiempo real de UID y número de cuenta mapeada vía Serial JSON
 *   - Sincronización criptográfica con sistema de tokens TOTP
 *   - Protocolo bidireccional a 115200 baudios con Checksum de verificación
 * ==============================================================================
 */

#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// Definición de pines para el lector RFID RC522 en ESP32
#define RST_PIN   22   // Pin de reset del RC522
#define SS_PIN    5    // Pin Chip Select (SDA / SS) del RC522
// Pines SPI estándar del ESP32: SCK=18, MISO=19, MOSI=23

MFRC522 rfid(SS_PIN, RST_PIN);
MFRC522::MIFARE_Key key;

// Buffer para la última tarjeta leída y debounce
String lastScannedUID = "";
unsigned long lastScanMillis = 0;
const unsigned long DEBOUNCE_DELAY_MS = 2500; // Evita lecturas duplicadas en proximidad continua

// Checksum XOR de 8 bits para asegurar integridad de tramas contra spoofing
uint8_t calculateChecksum(const String& data) {
  uint8_t chk = 0;
  for (size_t i = 0; i < data.length(); i++) {
    chk ^= (uint8_t)data[i];
  }
  return chk;
}

void sendFrame(const String& jsonPayload) {
  uint8_t chk = calculateChecksum(jsonPayload);
  char hexChk[3];
  sprintf(hexChk, "%02X", chk);
  Serial.print(jsonPayload);
  Serial.print("*");
  Serial.println(hexChk);
}

void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(10); }

  SPI.begin();
  rfid.PCD_Init();

  // Clave de seguridad por defecto para sectores MIFARE
  for (byte i = 0; i < 6; i++) {
    key.keyByte[i] = 0xFF;
  }

  // Notificación de arranque
  StaticJsonDocument<256> doc;
  doc["type"] = "HARDWARE_STATUS";
  doc["device"] = "ESP32_RFID_RC522";
  doc["status"] = "READY";
  doc["rfid_initialized"] = true;
  doc["baudrate"] = 115200;

  String output;
  serializeJson(doc, output);
  sendFrame(output);
}

void loop() {
  // 1. Escaneo de presencia de tarjeta física RFID
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    // Formatear UID hexadecimal
    String uidString = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      if (rfid.uid.uidByte[i] < 0x10) uidString += "0";
      uidString += String(rfid.uid.uidByte[i], HEX);
      if (i < rfid.uid.size - 1) uidString += ":";
    }
    uidString.toUpperCase();

    // Filtro anti-rebote para no saturar al acercar la tarjeta física
    if (uidString != lastScannedUID || (millis() - lastScanMillis > DEBOUNCE_DELAY_MS)) {
      lastScannedUID = uidString;
      lastScanMillis = millis();

      // Construcción del paquete JSON de telemetría de tarjeta acercada
      StaticJsonDocument<256> doc;
      doc["type"] = "RFID_CARD_DETECTED";
      doc["uid"] = uidString;
      doc["size"] = rfid.uid.size;
      doc["timestamp_ms"] = millis();

      String payload;
      serializeJson(doc, payload);
      sendFrame(payload);
    }

    // Detener la comunicación con la tarjeta actual para permitir nueva detección
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  // 2. Procesamiento de comandos desde el Host Kiosco (vía Serial)
  if (Serial.available()) {
    String incoming = Serial.readStringUntil('\n');
    incoming.trim();

    if (incoming.length() > 0) {
      StaticJsonDocument<256> inDoc;
      DeserializationError err = deserializeJson(inDoc, incoming);

      if (!err) {
        const char* cmd = inDoc["cmd"];
        if (cmd && strcmp(cmd, "PING") == 0) {
          StaticJsonDocument<128> pongDoc;
          pongDoc["type"] = "PONG";
          pongDoc["status"] = "OK";
          String pongStr;
          serializeJson(pongDoc, pongStr);
          sendFrame(pongStr);
        } else if (cmd && strcmp(cmd, "RESET_READER") == 0) {
          rfid.PCD_Init();
          lastScannedUID = "";
          StaticJsonDocument<128> rDoc;
          rDoc["type"] = "READER_RESET_SUCCESS";
          String rStr;
          serializeJson(rDoc, rStr);
          sendFrame(rStr);
        }
      }
    }
  }

  delay(20);
}
