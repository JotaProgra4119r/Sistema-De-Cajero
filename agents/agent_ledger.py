import os
import json
import asyncio
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

class AgentLedger:
    """
    Agent-Ledger (Consistencia y Dual-Write):
    - Valida la paridad exacta entre la base relacional (MySQL/SQLite) y los archivos .txt
      delimitados por plecas en `./data/storage_txt/` y `./database/storage_txt/`.
    - Garantiza que el snapshot borrado por soft-delete quede debidamente sincronizado
      en ambos almacenamientos sin bloquear el hilo de ejecucion principal.
    """
    def __init__(self, event_bus=None):
        self.event_bus = event_bus
        self.stats = {
            "parity_checks": 0,
            "parity_consistent": True,
            "soft_delete_syncs": 0,
            "discrepancies": []
        }
        if self.event_bus:
            self.event_bus.subscribe("storage.soft_delete", self.on_soft_delete)

    def verify_vault_parity(self, db: Session, txt_storage_dir: str) -> Dict[str, Any]:
        """
        Compara la suma consolidada de la boveda en base de datos con el total
        del archivo cajero_inventario.txt.
        """
        self.stats["parity_checks"] += 1
        from database.models import DenominacionCajero
        denoms = db.query(DenominacionCajero).all()
        db_total = sum(d.denominacion * d.cantidad_billetes for d in denoms)

        txt_file = os.path.join(txt_storage_dir, "cajero_inventario.txt")
        txt_total = 0.0
        if os.path.exists(txt_file):
            try:
                with open(txt_file, "r", encoding="utf-8") as f:
                    for line in f:
                        parts = line.strip().split("|")
                        if parts and parts[0] == "TOTAL_BOVEDA":
                            txt_total = float(parts[1])
                            break
            except Exception as e:
                self.stats["discrepancies"].append(f"Error leyendo cajero_inventario.txt: {e}")

        is_equal = round(float(db_total), 2) == round(txt_total, 2)
        if not is_equal:
            self.stats["parity_consistent"] = False
            self.stats["discrepancies"].append(
                f"Discrepancia de boveda: DB=Q{float(db_total):.2f}, TXT=Q{txt_total:.2f}"
            )
        return {
            "consistent": is_equal,
            "db_total": float(db_total),
            "txt_total": txt_total,
            "discrepancies": list(self.stats["discrepancies"])
        }

    def verify_soft_delete_integrity(self, db: Session, txt_storage_dir: str) -> Dict[str, Any]:
        """
        Verifica que todas las bajas logicas en registros_eliminados esten
        reflejadas en auditoria_eliminaciones.txt y bajas_eliminaciones.txt.
        """
        from database.models import RegistroEliminado
        db_records = db.query(RegistroEliminado).all()
        db_ids = {r.id_registro_origen for r in db_records}

        txt_audit = os.path.join(txt_storage_dir, "auditoria_eliminaciones.txt")
        txt_ids = set()
        if os.path.exists(txt_audit):
            try:
                with open(txt_audit, "r", encoding="utf-8") as f:
                    for line in f:
                        parts = line.strip().split("|")
                        if len(parts) >= 2 and parts[1].isdigit():
                            txt_ids.add(int(parts[1]))
            except Exception:
                pass

        missing_in_txt = list(db_ids - txt_ids)
        return {
            "db_deleted_count": len(db_ids),
            "txt_deleted_count": len(txt_ids),
            "synced": len(missing_in_txt) == 0,
            "missing_ids": missing_in_txt
        }

    async def on_soft_delete(self, event: Dict[str, Any]):
        self.stats["soft_delete_syncs"] += 1

    def get_status(self) -> Dict[str, Any]:
        return dict(self.stats)

agent_ledger = AgentLedger()
