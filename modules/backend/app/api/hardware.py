from typing import Dict
from fastapi import APIRouter
from pydantic import BaseModel
from backend.app.hardware.serial_controller import serial_controller
from backend.app.hardware.esp32_controller import esp32_controller

router = APIRouter(prefix="/api/hardware", tags=["Control de Hardware"])

class JamSimulationRequest(BaseModel):
    simulate_jam: bool

class DispenseTestRequest(BaseModel):
    bills: Dict[str, int]

@router.get("/status")
def get_hardware_status():
    esp_status = esp32_controller.get_status()
    return {
        "arduino_connected": serial_controller.is_connected,
        "arduino_mock": serial_controller.mock_mode,
        "arduino_port": serial_controller.port,
        "arduino_baudrate": serial_controller.baudrate,
        "jam_simulated": serial_controller.simulate_jam,
        **esp_status
    }

@router.post("/simulate-jam")
def toggle_jam(payload: JamSimulationRequest):
    serial_controller.set_simulate_jam(payload.simulate_jam)
    return {
        "status": "SUCCESS",
        "simulate_jam": payload.simulate_jam,
        "mensaje": f"Simulación de atasco {'activada' if payload.simulate_jam else 'desactivada'}."
    }

@router.post("/test-dispense")
async def test_dispense(payload: DispenseTestRequest):
    res = await serial_controller.dispense(payload.bills)
    return res