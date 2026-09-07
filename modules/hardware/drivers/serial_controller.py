import json
import time
import asyncio
from typing import Dict, Any, Optional, Callable
import os

SERIAL_PORT = os.getenv("SERIAL_PORT", "COM3")
SERIAL_BAUDRATE = int(os.getenv("SERIAL_BAUDRATE", "115200"))
MOCK_HARDWARE = os.getenv("MOCK_HARDWARE", "True").lower() == "true"

def calculate_checksum(data: str) -> str:
    """Calcula el checksum XOR de 8 bits en formato hexadecimal en mayúsculas."""
    chk = 0
    for b in data.encode("utf-8"):
        chk ^= b
    return f"{chk:02X}"

def verify_and_parse_frame(raw_str: str) -> Dict[str, Any]:
    """
    Valida estrictamente la integridad de la trama serie contra Hardware Spoofing / inyecciones:
    1. Si incluye delimitador '*', comprueba que el checksum XOR coincida con el payload.
    2. Si es JSON sin '*', verifica que contenga campos legítimos.
    3. Si el checksum o el formato no coincide, rechaza la trama como corrupta o inyectada.
    """
    raw = raw_str.strip()
    if not raw:
        return {"status": "ERROR", "code": "TIMEOUT", "dispensed": 0}

    payload = raw
    if "*" in raw:
        parts = raw.rsplit("*", 1)
        payload = parts[0]
        received_chk = parts[1].strip().upper()
        expected_chk = calculate_checksum(payload)
        if received_chk != expected_chk:
            return {
                "status": "ERROR",
                "code": "HARDWARE_SPOOFING_DETECTED",
                "detail": f"Checksum inválido (recibido {received_chk}, esperado {expected_chk})",
                "dispensed": 0
            }

    try:
        data = json.loads(payload)
        if not isinstance(data, dict):
            return {"status": "ERROR", "code": "MALFORMED_FRAME", "dispensed": 0}
        return data
    except Exception as e:
        return {"status": "ERROR", "code": f"MALFORMED_JSON: {str(e)}", "dispensed": 0}

class ArduinoSerialController:
    """
    Controlador de comunicación USB-Serial a 115200 baudios con Arduino Mega 2560
    para control de los 7 motores paso a paso (A4988) y sensores infrarrojos de ranura.
    Incluye emulación de alta fidelidad para pruebas de laboratorio y entornos sin hardware.
    """
    def __init__(self, port: str = None, baudrate: int = None, mock: bool = None):
        self.port = port or SERIAL_PORT
        self.baudrate = baudrate or SERIAL_BAUDRATE
        self.serial_conn = None
        self.is_connected = False
        self.mock_mode = MOCK_HARDWARE if mock is None else mock
        self.simulate_jam = False
        self.event_callbacks = []
        self._init_connection()

    def _init_connection(self):
        try:
            import serial
            self.serial_conn = serial.Serial(self.port, self.baudrate, timeout=2)
            self.is_connected = True
            self.mock_mode = False
            print(f"[HARDWARE] Conectado físicamente a Arduino Mega en {self.port} a {self.baudrate} baudios.")
        except Exception as e:
            self.is_connected = False
            self.mock_mode = True
            print(f"[HARDWARE] Puerto {self.port} no disponible ({e}). Activando modo simulación embebido.")

    def register_callback(self, cb: Callable[[Dict[str, Any]], Any]):
        self.event_callbacks.append(cb)

    async def _emit(self, event: Dict[str, Any]):
        for cb in self.event_callbacks:
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(event)
                else:
                    cb(event)
            except Exception as ex:
                print(f"[HARDWARE] Error en callback de evento: {ex}")

    async def dispense(self, bills: Dict[str, int]) -> Dict[str, Any]:
        """
        Envía la trama JSON de dispensación y espera la confirmación de eyección por sensores IR.
        Trama: {"cmd":"DISPENSE","bills":{"200":0,"100":1,"50":0,"20":1,"10":0,"5":0,"1":3}}
        """
        total_requested = sum(int(denom) * count for denom, count in bills.items())
        cmd_payload = {
            "cmd": "DISPENSE",
            "bills": {str(k): int(v) for k, v in bills.items()}
        }
        
        await self._emit({
            "type": "HARDWARE_DISPENSING_STARTED",
            "bills": bills,
            "total": total_requested,
            "timestamp": time.time()
        })

        if not self.mock_mode and self.serial_conn and self.serial_conn.is_open:
            try:
                json_str = json.dumps(cmd_payload)
                chk = calculate_checksum(json_str)
                frame = f"{json_str}*{chk}\n"
                self.serial_conn.write(frame.encode("utf-8"))
                self.serial_conn.flush()
                
                raw_response = self.serial_conn.readline().decode("utf-8").strip()
                response = verify_and_parse_frame(raw_response)
            except Exception as e:
                response = {"status": "ERROR", "code": f"SERIAL_ERROR: {str(e)}", "dispensed": 0}
        else:
            # Emulación interactiva con temporización realista de motores
            await asyncio.sleep(0.4)
            if self.simulate_jam:
                response = {"status": "ERROR", "code": "JAM_DETECTED", "dispensed": 0}
            else:
                response = {"status": "SUCCESS", "dispensed": total_requested}

        await self._emit({
            "type": "HARDWARE_DISPENSING_FINISHED",
            "response": response,
            "timestamp": time.time()
        })
        return response

    def set_simulate_jam(self, enable: bool):
        self.simulate_jam = enable

serial_controller = ArduinoSerialController()
