import asyncio
import time
from typing import Dict, List, Callable, Any, Optional

class EventBus:
    """
    Bus de eventos asincrono y mediador desacoplado para el enjambre multiagente de Graphify.
    Permite el intercambio de senales en tiempo real entre agentes y el flujo principal
    sin bloquear el motor transaccional del cajero automatico.
    """
    def __init__(self):
        self._subscribers: Dict[str, List[Callable[[Dict[str, Any]], Any]]] = {}
        self._history: List[Dict[str, Any]] = []
        self._max_history = 200

    def subscribe(self, event_type: str, handler: Callable[[Dict[str, Any]], Any]):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)

    async def publish(self, event_type: str, data: Optional[Dict[str, Any]] = None):
        event = {
            "type": event_type,
            "data": data or {},
            "timestamp": time.time()
        }
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history.pop(0)

        handlers = list(self._subscribers.get(event_type, [])) + list(self._subscribers.get("*", []))
        for h in handlers:
            try:
                if asyncio.iscoroutinefunction(h):
                    asyncio.create_task(h(event))
                else:
                    h(event)
            except Exception as e:
                print(f"[EVENT_BUS] Error en suscriptor ({event_type}): {e}")

    def get_recent_events(self, limit: int = 20) -> List[Dict[str, Any]]:
        return list(reversed(self._history))[:limit]

event_bus = EventBus()
