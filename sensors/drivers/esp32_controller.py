import time
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional

class ESP32Controller:
    """
    Controlador para microcontrolador ESP32 y Lector RFID RC522.
    Gestiona la telemetría del ESP32, comunicación para sistema de tokens TOTP,
    detección de tarjetas físicas por proximidad RFID y modo de depuración interactivo.
    """
    def __init__(self):
        self.esp32_connected = True
        self.mock_mode = True
        self.port = "COM3"
        self.baudrate = 115200
        self.rfid_ready = True
        self.debug_mode = True
        self.totp_synced = True
        self.last_scanned_uid: Optional[str] = "B4:5A:21:8F"
        self.last_scanned_card: Optional[str] = "1234567812345678"
        self.last_scanned_time: Optional[str] = None
        self.debug_logs: List[Dict[str, Any]] = [
            {
                "timestamp": datetime.now().strftime("%H:%M:%S"),
                "level": "INFO",
                "message": "Controlador ESP32 inicializado. Módulo RFID RC522 listo en bus SPI (Pines 21/22/19/23)."
            },
            {
                "timestamp": datetime.now().strftime("%H:%M:%S"),
                "level": "INFO",
                "message": "Sincronizador criptográfico TOTP sincronizado con el host."
            }
        ]

    def add_debug_log(self, message: str, level: str = "INFO"):
        entry = {
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "level": level,
            "message": message
        }
        self.debug_logs.append(entry)
        if len(self.debug_logs) > 30:
            self.debug_logs = self.debug_logs[-30:]

    def toggle_debug_mode(self, active: bool) -> bool:
        self.debug_mode = active
        self.add_debug_log(
            f"Modo de depuración RFID {'ACTIVADO' if active else 'DESACTIVADO'}.",
            level="WARN" if active else "INFO"
        )
        return self.debug_mode

    def simulate_rfid_tap(self, card_number: str, uid: Optional[str] = None) -> Dict[str, Any]:
        """
        Simula o procesa la lectura física de una tarjeta RFID en el módulo RC522 del ESP32.
        """
        clean_card = card_number.replace("-", "").replace(" ", "").strip()
        simulated_uid = uid or f"{abs(hash(clean_card)) % 256:02X}:{(abs(hash(clean_card)) >> 8) % 256:02X}:{(abs(hash(clean_card)) >> 16) % 256:02X}:{(abs(hash(clean_card)) >> 24) % 256:02X}"
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        self.last_scanned_uid = simulated_uid
        self.last_scanned_card = clean_card
        self.last_scanned_time = now_str

        formatted_card = "-".join([clean_card[i:i+4] for i in range(0, len(clean_card), 4)]) if len(clean_card) == 16 else clean_card

        self.add_debug_log(f"[RC522-SPI] Detección de proximidad: Tag UID [{simulated_uid}]", level="INFO")
        self.add_debug_log(f"[ESP32-AUTH] Tarjeta física resuelta: {formatted_card}", level="SUCCESS")
        self.add_debug_log(f"[ESP32-CRYPTO] Enlace de token TOTP verificado. Trama transmitida al Kiosco.", level="INFO")

        return {
            "status": "SUCCESS",
            "uid": simulated_uid,
            "card_number": clean_card,
            "formatted_card": formatted_card,
            "timestamp": now_str,
            "message": f"Lectura RFID exitosa: Tarjeta {formatted_card} (UID {simulated_uid})"
        }

    def get_status(self) -> Dict[str, Any]:
        return {
            "esp32_connected": self.esp32_connected,
            "esp32_port": self.port,
            "esp32_baudrate": self.baudrate,
            "rfid_ready": self.rfid_ready,
            "debug_mode": self.debug_mode,
            "totp_synced": self.totp_synced,
            "last_scanned_uid": self.last_scanned_uid,
            "last_scanned_card": self.last_scanned_card,
            "last_scanned_time": self.last_scanned_time,
            "debug_logs": self.debug_logs,
            "timestamp": time.time()
        }

esp32_controller = ESP32Controller()

