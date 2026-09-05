import os
import json
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from backend.app.core.config import settings

class TxtStorageManager:
    """
    Gestor del patrón Dual-Write Concurrente para archivos de texto plano delimitados por plecas (|).
    Utiliza asyncio.Lock para garantizar integridad atómica en entornos concurrentes.
    """
    def __init__(self, storage_dir: Optional[str] = None):
        self.storage_dir = storage_dir or settings.TXT_STORAGE_PATH
        os.makedirs(self.storage_dir, exist_ok=True)
        self.lock = asyncio.Lock()
        
        self.users_file = os.path.join(self.storage_dir, "usuarios.txt")
        self.inventory_file = os.path.join(self.storage_dir, "cajero_inventario.txt")
        self.tx_file = os.path.join(self.storage_dir, "transacciones_historico.txt")
        self.audit_file = os.path.join(self.storage_dir, "auditoria_eventos.txt")

    async def sync_all_from_db(self, db):
        """Sincroniza el estado completo de la BD hacia los archivos planos."""
        from backend.app.db.models import Usuario, DenominacionCajero, Transaccion, LogAuditoria
        async with self.lock:
            # 1. usuarios.txt
            users = db.query(Usuario).all()
            lines = []
            for u in users:
                active_card = next((c.numero_tarjeta for c in u.tarjetas if c.activa), "0000000000000000")
                last_acc = u.fecha_ultimo_acceso.strftime("%Y-%m-%d %H:%M:%S") if u.fecha_ultimo_acceso else ""
                pin_flag = "1" if u.cambio_pin_realizado else "0"
                line = f"{u.id_usuario}|{u.nombre_completo}|{active_card}|{u.pin_hash}|{float(u.saldo_actual):.2f}|{float(u.monto_max_diario):.2f}|{float(u.total_retirado_hoy):.2f}|{pin_flag}|{last_acc}"
                lines.append(line)
            with open(self.users_file, "w", encoding="utf-8") as f:
                f.write("\n".join(lines) + "\n" if lines else "")

            # 2. cajero_inventario.txt
            denoms = db.query(DenominacionCajero).order_by(DenominacionCajero.denominacion.desc()).all()
            total_vault = sum(d.denominacion * d.cantidad_billetes for d in denoms)
            inv_lines = [f"TOTAL_BOVEDA|{total_vault:.2f}"]
            for d in denoms:
                sub = d.denominacion * d.cantidad_billetes
                inv_lines.append(f"{d.denominacion}|{d.cantidad_billetes}|{sub:.2f}")
            with open(self.inventory_file, "w", encoding="utf-8") as f:
                f.write("\n".join(inv_lines) + "\n")

    async def update_usuario(self, user_id: int, nombre: str, tarjeta: str, pin_hash: str, saldo: float, max_diario: float, retirado_hoy: float, pin_cambiado: bool, ultimo_acceso: Optional[datetime] = None):
        async with self.lock:
            lines = []
            updated = False
            pin_flag = "1" if pin_cambiado else "0"
            last_acc_str = ultimo_acceso.strftime("%Y-%m-%d %H:%M:%S") if ultimo_acceso else datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            new_line = f"{user_id}|{nombre}|{tarjeta}|{pin_hash}|{saldo:.2f}|{max_diario:.2f}|{retirado_hoy:.2f}|{pin_flag}|{last_acc_str}"
            
            if os.path.exists(self.users_file):
                with open(self.users_file, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        parts = line.split("|")
                        if parts and parts[0] == str(user_id):
                            lines.append(new_line)
                            updated = True
                        else:
                            lines.append(line)
            if not updated:
                lines.append(new_line)
            with open(self.users_file, "w", encoding="utf-8") as f:
                f.write("\n".join(lines) + "\n")

    async def update_inventario(self, inventory_dict: Dict[int, int]):
        """Actualiza el stock de denominaciones y recalcula la primera línea con el total consolidado."""
        async with self.lock:
            # Order descending 200, 100, 50, 20, 10, 5, 1
            ordered_denoms = [200, 100, 50, 20, 10, 5, 1]
            total = sum(d * inventory_dict.get(d, 0) for d in ordered_denoms)
            lines = [f"TOTAL_BOVEDA|{total:.2f}"]
            for d in ordered_denoms:
                cnt = inventory_dict.get(d, 0)
                sub = d * cnt
                lines.append(f"{d}|{cnt}|{sub:.2f}")
            with open(self.inventory_file, "w", encoding="utf-8") as f:
                f.write("\n".join(lines) + "\n")

    async def append_transaccion(self, tx_id: int, user_id: int, tx_type: str, amount: float, breakdown: Dict[str, int], dt: Optional[datetime] = None):
        async with self.lock:
            ts = dt.strftime("%Y-%m-%d %H:%M:%S") if dt else datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            b_json = json.dumps(breakdown)
            line = f"{tx_id}|{ts}|{user_id}|{tx_type}|{amount:.2f}|{b_json}\n"
            with open(self.tx_file, "a", encoding="utf-8") as f:
                f.write(line)

    async def append_auditoria(self, log_id: int, user_id: Optional[int], accion: str, detalles: str, dt: Optional[datetime] = None):
        async with self.lock:
            ts = dt.strftime("%Y-%m-%d %H:%M:%S") if dt else datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            u_str = str(user_id) if user_id is not None else ""
            clean_det = detalles.replace("\n", " ").replace("|", " ")
            line = f"{log_id}|{ts}|{u_str}|{accion}|{clean_det}\n"
            with open(self.audit_file, "a", encoding="utf-8") as f:
                f.write(line)

    async def get_last_transactions(self, user_id: int, limit: int = 5) -> List[Dict[str, Any]]:
        """Extrae directamente de transacciones_historico.txt las últimas transacciones del usuario."""
        async with self.lock:
            user_txs = []
            if os.path.exists(self.tx_file):
                with open(self.tx_file, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        parts = line.split("|")
                        if len(parts) >= 6 and parts[2] == str(user_id):
                            user_txs.append({
                                "id_transaccion": int(parts[0]),
                                "fecha_hora": parts[1],
                                "id_usuario": int(parts[2]),
                                "tipo": parts[3],
                                "monto": float(parts[4]),
                                "desglose": json.loads(parts[5]) if parts[5] else {}
                            })
            return list(reversed(user_txs))[:limit]

txt_manager = TxtStorageManager()