import json
import time
import asyncio
from typing import Dict, Any, Optional, Callable
from backend.app.core.config import settings

class ArduinoSerialController:
    """
    Controlador de comunicación USB-Serial a 115200 baudios con Arduino Mega 2560
    para control de los 7 motores paso a paso y sensores infrarrojos de ranura.
    Incluye emulación de alta fidelidad para pruebas de laboratorio.
    """
    def __init__(self):
        self.port = settings.SERIAL_PORT
        self.baudrate = settings.SERIAL_BAUDRATE
        self.serial_conn = None
        self.is_connected = False
        self.mock_mode = settings.MOCK_HARDWARE
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
        Envía la trama JSON de dispensación y espera la confirmación de eyección.
        Trama: {"cmd":"DISPENSE","bills":{"200":0,"100":1,"50":0,"20":1,"10":0,"5":0,"1":3}}
        """
        # Calculate total to dispense
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
                json_str = json.dumps(cmd_payload) + "\n"
                self.serial_conn.write(json_str.encode("utf-8"))
                self.serial_conn.flush()
                
                # Read response line
                raw_response = self.serial_conn.readline().decode("utf-8").strip()
                if raw_response:
                    response = json.loads(raw_response)
                else:
                    response = {"status": "ERROR", "code": "TIMEOUT", "dispensed": 0}
            except Exception as e:
                response = {"status": "ERROR", "code": f"SERIAL_ERROR: {str(e)}", "dispensed": 0}
        else:
            # Emulación interactiva con temporización realista de motores
            await asyncio.sleep(0.4) # Simula rotación de motores A4988 y paso por sensores IR
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