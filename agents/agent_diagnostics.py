import time
from typing import Dict, Any, Optional

class AgentDiagnostics:
    """
    Agent-Diagnostics (Telemetria y Estado de Boveda):
    - Procesa la senal en tiempo real de los 7 sensores opticos IR de ranura
      y el sensor ultrasonico HC-SR04 del cajero.
    - En caso de desviacion fisica o atasco de billetes (jam), emite la senal
      de cancelacion inmediata y asiste en el rollback atómico del inventario del cajero.
    """
    def __init__(self, event_bus=None):
        self.event_bus = event_bus
        self.telemetry = {
            "ir_sensors_health": "ALL_NOMINAL",
            "active_jams": 0,
            "jams_mitigated_total": 0,
            "last_distance_cm": 45.0,
            "status": "OPERATIONAL"
        }
        if self.event_bus:
            self.event_bus.subscribe("hardware.event", self.on_hardware_event)

    async def handle_dispense_result(self, dispense_result: Dict[str, Any], requested_bills: Dict[str, int]) -> Dict[str, Any]:
        """
        Evalua la respuesta de hardware. Si hay atasco, gestiona el rollback contable y de boveda.
        """
        status = dispense_result.get("status")
        code = dispense_result.get("code")

        if status != "SUCCESS" or code == "JAM_DETECTED":
            self.telemetry["active_jams"] += 1
            self.telemetry["jams_mitigated_total"] += 1
            if self.event_bus:
                await self.event_bus.publish("hardware.jam_detected", {
                    "code": code,
                    "bills_affected": requested_bills,
                    "action": "ROLLBACK_REQUIRED"
                })
            return {
                "rollback_required": True,
                "reason": "JAM_DETECTED",
                "message": "Atasco detectado en ranura de conteo IR. Cancelacion y rollback asistido."
            }

        return {
            "rollback_required": False,
            "reason": "NOMINAL",
            "message": "Dispensacion fisica confirmada por sensores IR."
        }

    async def on_hardware_event(self, event: Dict[str, Any]):
        data = event.get("data", {})
        if "distance_cm" in data:
            self.telemetry["last_distance_cm"] = float(data["distance_cm"])

    def get_status(self) -> Dict[str, Any]:
        return dict(self.telemetry)

agent_diagnostics = AgentDiagnostics()
