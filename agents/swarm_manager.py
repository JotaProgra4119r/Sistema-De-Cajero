from typing import Dict, Any
from agents.event_bus import event_bus
from agents.agent_sentinel import AgentSentinel, agent_sentinel
from agents.agent_ledger import AgentLedger, agent_ledger
from agents.agent_diagnostics import AgentDiagnostics, agent_diagnostics
from agents.agent_context import AgentContext, agent_context

class SwarmManager:
    """
    Orquestador del enjambre multiagente de Graphify.
    Conecta los 4 agentes al bus de eventos y provee telemetria unificada.
    """
    def __init__(self):
        self.bus = event_bus
        self.sentinel = agent_sentinel
        self.ledger = agent_ledger
        self.diagnostics = agent_diagnostics
        self.context = agent_context
        self._wire_agents()

    def _wire_agents(self):
        self.sentinel.event_bus = self.bus
        self.ledger.event_bus = self.bus
        self.diagnostics.event_bus = self.bus

    def get_swarm_health(self) -> Dict[str, Any]:
        return {
            "status": "OPERATIONAL",
            "agents": {
                "Agent-Sentinel": self.sentinel.get_status(),
                "Agent-Ledger": self.ledger.get_status(),
                "Agent-Diagnostics": self.diagnostics.get_status(),
                "Agent-Context": self.context.analyze_graph_structure()
            }
        }

swarm_manager = SwarmManager()
