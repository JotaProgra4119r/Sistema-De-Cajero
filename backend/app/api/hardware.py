from typing import Dict, Optional
from fastapi import APIRouter
from pydantic import BaseModel
from backend.app.hardware.serial_controller import serial_controller
from backend.app.hardware.esp32_controller import esp32_controller
from backend.app.api.ws import ws_manager

router = APIRouter(prefix="/api/hardware", tags=["Control de Hardware"])

class JamSimulationRequest(BaseModel):
    simulate_jam: bool

class DispenseTestRequest(BaseModel):
    bills: Dict[str, int]

class RfidTapRequest(BaseModel):
    card_number: str
    uid: Optional[str] = None

class RfidDebugModeRequest(BaseModel):
    active: bool

@router.get("/status")
def get_hardware_status():
    esp_status = esp32_controller.get_status()
    return {
        # Compatibilidad de dispensador y motores (ahora orquestados por el ESP32)
        "controller_type": "ESP32",
        "esp32_connected": esp_status.get("esp32_connected", True),
        "esp32_port": esp_status.get("esp32_port", "COM3"),
        "esp32_baudrate": esp_status.get("esp32_baudrate", 115200),
        "arduino_connected": esp_status.get("esp32_connected", True), # Alias retrocompatible
        "arduino_mock": serial_controller.mock_mode,
        "arduino_port": esp_status.get("esp32_port", "COM3"),
        "arduino_baudrate": esp_status.get("esp32_baudrate", 115200),
        "jam_simulated": serial_controller.simulate_jam,
        **esp_status
    }

@router.post("/simulate-jam")
def toggle_jam(payload: JamSimulationRequest):
    serial_controller.set_simulate_jam(payload.simulate_jam)
    return {
        "status": "SUCCESS",
        "simulate_jam": payload.simulate_jam,
        "mensaje": f"Simulación de atasco mecánico {'activada' if payload.simulate_jam else 'desactivada'}."
    }

@router.post("/test-dispense")
async def test_dispense(payload: DispenseTestRequest):
    res = await serial_controller.dispense(payload.bills)
    return res

@router.post("/rfid/simulate-tap")
async def simulate_rfid_tap(payload: RfidTapRequest):
    result = esp32_controller.simulate_rfid_tap(payload.card_number, payload.uid)
    # Broadcast to all connected clients (e.g. Kiosk Welcome screen)
    await ws_manager.broadcast({
        "type": "RFID_CARD_DETECTED",
        "card_number": result["card_number"],
        "formatted_card": result["formatted_card"],
        "uid": result["uid"],
        "message": result["message"]
    })
    return result

@router.post("/rfid/debug-mode")
def toggle_rfid_debug(payload: RfidDebugModeRequest):
    new_state = esp32_controller.toggle_debug_mode(payload.active)
    return {
        "status": "SUCCESS",
        "debug_mode": new_state,
        "mensaje": f"Modo depuración RFID {'activado' if new_state else 'desactivado'}."
    }