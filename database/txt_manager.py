import os
import json
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session

class TxtStorageManager:
    """
    Gestor del patrón Dual-Write Concurrente para archivos de texto plano delimitados por plecas (|).
    Sincroniza y escribe simultáneamente en `database/storage_txt/` y `data/storage_txt/`.
    Garantiza consistencia atómica mediante asyncio.Lock.
    """
    def __init__(self, base_paths=None):
        if base_paths is None:
            curr_dir = os.path.dirname(os.path.abspath(__file__))
            p1 = os.path.join(curr_dir, "storage_txt")
            p2 = os.path.abspath(os.path.join(curr_dir, "..", "data", "storage_txt"))
            self.base_paths = [p1, p2]
        else:
            self.base_paths = base_paths if isinstance(base_paths, list) else [base_paths]

        self.lock = asyncio.Lock()
        for p in self.base_paths:
            os.makedirs(p, exist_ok=True)

    def _write_file_all_paths(self, filename: str, content: str, mode: str = "w"):
        for base_path in self.base_paths:
            try:
                target = os.path.join(base_path, filename)
                with open(target, mode, encoding="utf-8") as f:
                    f.write(content)
            except Exception as e:
                print(f"[TXT_STORAGE] Error escribiendo {filename} en {base_path}: {e}")

    def _read_file_first_available(self, filename: str) -> str:
        for base_path in self.base_paths:
            target = os.path.join(base_path, filename)
            if os.path.exists(target):
                try:
                    with open(target, "r", encoding="utf-8") as f:
                        return f.read()
                except Exception:
                    pass
        return ""

    async def sync_all_from_db(self, db: Session):
        async with self.lock:
            from database.models import Usuario, DenominacionCajero, Transaccion, LogAuditoria

            # 1. usuarios.txt
            users = db.query(Usuario).all()
            lines_users = []
            for u in users:
                active_card = next((c.numero_tarjeta for c in u.tarjetas if c.activa and not c.is_deleted), "0000000000000000")
                last_access = u.fecha_ultimo_acceso.strftime("%Y-%m-%d %H:%M:%S") if u.fecha_ultimo_acceso else ""
                pin_flag = "1" if u.cambio_pin_realizado else "0"
                line = f"{u.id_usuario}|{u.nombre_completo}|{active_card}|{u.pin_hash}|{float(u.saldo_actual):.2f}|{float(u.monto_max_diario):.2f}|{float(u.total_retirado_hoy):.2f}|{pin_flag}|{last_access}"
                lines_users.append(line)
            self._write_file_all_paths("usuarios.txt", "\n".join(lines_users) + "\n" if lines_users else "", mode="w")

            # 2. cajero_inventario.txt
            denoms = db.query(DenominacionCajero).order_by(DenominacionCajero.denominacion.desc()).all()
            total_vault = sum(d.denominacion * d.cantidad_billetes for d in denoms)
            lines_inv = [f"TOTAL_BOVEDA|{total_vault:.2f}"]
            for d in denoms:
                subtotal = d.denominacion * d.cantidad_billetes
                lines_inv.append(f"{d.denominacion}|{d.cantidad_billetes}|{subtotal:.2f}")
            self._write_file_all_paths("cajero_inventario.txt", "\n".join(lines_inv) + "\n", mode="w")

            # 3. transacciones_historico.txt
            txs = db.query(Transaccion).order_by(Transaccion.fecha_hora.asc()).all()
            lines_tx = []
            for tx in txs:
                ts = tx.fecha_hora.strftime("%Y-%m-%d %H:%M:%S")
                bills_str = json.dumps(tx.desglose_billetes)
                lines_tx.append(f"{tx.id_transaccion}|{ts}|{tx.id_usuario}|{tx.tipo_transaccion}|{float(tx.monto):.2f}|{bills_str}")
            if lines_tx:
                self._write_file_all_paths("transacciones_historico.txt", "\n".join(lines_tx) + "\n", mode="w")

            # 4. auditoria_eventos.txt
            logs = db.query(LogAuditoria).order_by(LogAuditoria.fecha_hora.asc()).all()
            lines_log = []
            for l in logs:
                ts = l.fecha_hora.strftime("%Y-%m-%d %H:%M:%S")
                clean_det = (l.detalles or "").replace("\n", " ").replace("|", " ")
                lines_log.append(f"{l.id_log}|{ts}|{l.id_usuario or ''}|{l.accion}|{clean_det}")
            if lines_log:
                self._write_file_all_paths("auditoria_eventos.txt", "\n".join(lines_log) + "\n", mode="w")

    async def update_usuario(self, user_id: int, name: str, card: str, pin_hash: str, saldo: float, max_diario: float, retirado_hoy: float, pin_changed: bool, last_access: Optional[datetime] = None, is_deleted: bool = False):
        async with self.lock:
            content = self._read_file_first_available("usuarios.txt")
            lines = content.strip().split("\n") if content.strip() else []
            new_lines = []
            found = False
            last_access_str = last_access.strftime("%Y-%m-%d %H:%M:%S") if last_access else ""
            pin_flag = "1" if pin_changed else "0"
            updated_line = f"{user_id}|{name}|{card}|{pin_hash}|{saldo:.2f}|{max_diario:.2f}|{retirado_hoy:.2f}|{pin_flag}|{last_access_str}"

            for line in lines:
                parts = line.split("|")
                if parts and parts[0] == str(user_id):
                    new_lines.append(updated_line)
                    found = True
                else:
                    if line.strip():
                        new_lines.append(line)

            if not found:
                new_lines.append(updated_line)

            self._write_file_all_paths("usuarios.txt", "\n".join(new_lines) + "\n", mode="w")

    async def update_inventario(self, inventory_dict: Dict[int, int]):
        async with self.lock:
            ordered_denoms = [200, 100, 50, 20, 10, 5, 1]
            total = sum(d * inventory_dict.get(d, 0) for d in ordered_denoms)
            lines = [f"TOTAL_BOVEDA|{total:.2f}"]
            for d in ordered_denoms:
                cnt = inventory_dict.get(d, 0)
                sub = d * cnt
                lines.append(f"{d}|{cnt}|{sub:.2f}")
            self._write_file_all_paths("cajero_inventario.txt", "\n".join(lines) + "\n", mode="w")

    async def append_transaccion(self, tx_id: int, user_id: int, tx_type: str, amount: float, breakdown: Any, dt: Optional[datetime] = None):
        async with self.lock:
            ts = dt.strftime("%Y-%m-%d %H:%M:%S") if dt else datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            b_json = json.dumps(breakdown) if isinstance(breakdown, (dict, list)) else str(breakdown)
            line = f"{tx_id}|{ts}|{user_id}|{tx_type}|{amount:.2f}|{b_json}\n"
            self._write_file_all_paths("transacciones_historico.txt", line, mode="a")

    async def append_auditoria(self, log_id: int, user_id: Optional[int], accion: str, detalles: str, dt: Optional[datetime] = None):
        async with self.lock:
            ts = dt.strftime("%Y-%m-%d %H:%M:%S") if dt else datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            u_str = str(user_id) if user_id is not None else ""
            clean_det = (detalles or "").replace("\n", " ").replace("|", " ")
            line = f"{log_id}|{ts}|{u_str}|{accion}|{clean_det}\n"
            self._write_file_all_paths("auditoria_eventos.txt", line, mode="a")

    async def append_registro_eliminado(self, id_elim: int, tabla: str, id_origen: int, motivo: str, eliminado_por: str, afectado_id: Optional[int], dt: Optional[datetime] = None):
        async with self.lock:
            ts = dt.strftime("%Y-%m-%d %H:%M:%S") if dt else datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            line = f"{id_elim}|{ts}|{tabla}|{id_origen}|{eliminado_por}|{afectado_id or 'N/A'}|{motivo}\n"
            self._write_file_all_paths("bajas_eliminaciones.txt", line, mode="a")

    async def get_last_transactions(self, user_id: int, limit: int = 5) -> List[Dict[str, Any]]:
        """Extrae directamente de transacciones_historico.txt las últimas transacciones del usuario."""
        async with self.lock:
            user_txs = []
            content = self._read_file_first_available("transacciones_historico.txt")
            if content:
                for line in content.strip().split("\n"):
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split("|")
                    if len(parts) >= 6 and parts[2] == str(user_id):
                        try:
                            user_txs.append({
                                "id_transaccion": int(parts[0]),
                                "fecha_hora": parts[1],
                                "id_usuario": int(parts[2]),
                                "tipo": parts[3],
                                "monto": float(parts[4]),
                                "desglose": json.loads(parts[5]) if parts[5] else {}
                            })
                        except Exception:
                            pass
            return list(reversed(user_txs))[:limit]

txt_manager = TxtStorageManager()
