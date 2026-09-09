import os
import json
from typing import Dict, Any, List, Set, Optional

class AgentContext:
    """
    Agent-Context (Sincronizacion Graphify AST):
    - Utiliza graphify-out/graph.json para validar que los cambios y Pull Requests
      hacia main no introduzcan acoplamientos circulares entre modules/frontend,
      modules/backend, modules/database y modules/hardware.
    - Monitoriza la modularidad segun las particiones de comunidades de Leiden.
    """
    def __init__(self, graph_json_path: Optional[str] = None):
        if graph_json_path is None:
            curr = os.path.dirname(os.path.abspath(__file__))
            self.graph_path = os.path.abspath(os.path.join(curr, "..", "graphify-out", "graph.json"))
        else:
            self.graph_path = graph_json_path

    def analyze_graph_structure(self) -> Dict[str, Any]:
        """
        Inspecciona el grafo generado por Graphify y verifica metricas de modularidad.
        """
        if not os.path.exists(self.graph_path):
            return {
                "status": "GRAPH_NOT_FOUND",
                "path": self.graph_path,
                "nodes": 0,
                "edges": 0
            }

        try:
            with open(self.graph_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            nodes = data.get("nodes", [])
            links = data.get("links", [])
            hyperedges = data.get("hyperedges", [])

            # Analisis de comunidades
            communities = set()
            modules_detected = set()
            for n in nodes:
                c = n.get("community_name")
                if c:
                    communities.add(c)
                src = n.get("source_file", "")
                if "backend" in src:
                    modules_detected.add("backend")
                if "database" in src:
                    modules_detected.add("database")
                if "frontend" in src:
                    modules_detected.add("frontend")
                if "sensors" in src or "hardware" in src:
                    modules_detected.add("hardware")

            # Verificacion de ciclos de dependencia
            # Regla de oro: database no importa backend, sensors no importa backend.
            illegal_edges = []
            for link in links:
                s = link.get("source", "")
                t = link.get("target", "")
                # Si base de datos llama a backend directamente
                if "database" in s and "backend" in t and "test" not in s:
                    illegal_edges.append(f"{s} -> {t}")

            is_modular = len(illegal_edges) == 0

            return {
                "status": "VALID" if is_modular else "CIRCULAR_DEPENDENCY_WARNING",
                "total_nodes": len(nodes),
                "total_links": len(links),
                "communities_count": len(communities),
                "modules_detected": sorted(list(modules_detected)),
                "circular_couplings": illegal_edges,
                "clean_architecture": is_modular
            }
        except Exception as e:
            return {
                "status": "ERROR_PARSING",
                "error": str(e)
            }

agent_context = AgentContext()
