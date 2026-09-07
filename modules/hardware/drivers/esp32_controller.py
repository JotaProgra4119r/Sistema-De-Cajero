import time
import asyncio
from typing import Dict, Any

class ESP32Controller:
    """
    Controlador para ESP32-CAM (cámara OV2640) y Sensor Ultrasónico HC-SR04.
    Provee telemetría de presencia y capturas fotográficas de seguridad en transacciones.
    """
    def __init__(self):
        self.camera_streaming = True
        self.optical_sensors_ready = True
        self.vault_active = True
        self.user_present = True
        self.distance_cm = 45.0 # Rango de proximidad del usuario frente al kiosco (<100cm)

    def get_status(self) -> Dict[str, Any]:
        return {
            "vault_active": self.vault_active,
            "optical_sensors_ready": self.optical_sensors_ready,
            "camera_streaming": self.camera_streaming,
            "user_present": self.user_present,
            "distance_cm": self.distance_cm,
            "timestamp": time.time()
        }

    async def capture_transaction_photo(self, tx_id: int) -> str:
        """Simula o captura la fotografía de auditoría de la cámara OV2640."""
        filename = f"security_tx_{tx_id}_{int(time.time())}.jpg"
        return filename

esp32_controller = ESP32Controller()
