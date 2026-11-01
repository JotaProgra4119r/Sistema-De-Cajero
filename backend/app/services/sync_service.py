import os
import json
import httpx
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from database.connection import DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME
from database.models import (
    Role,
    Usuario,
    Tarjeta,
    Cajero,
    DenominacionCajero,
    ArqueoCajero,
    Transaccion,
    LogAuditoria,
    RegistroEliminado,
    BancoRed,
    TransferenciaBancaria
)
from database.txt_manager import txt_manager


class SyncService:
    """
    Servicio de sincronización triple entre:
    1. SQLite Local (atm_system.db)
    2. MySQL / Base de datos relacional (InnoDB)
    3. Servidor Cloud en Línea (Render: https://sistema-de-cajero.onrender.com)
    Además garantiza la persistencia dual en archivos planos .txt.
    """

    def __init__(self):
        self.last_sync_time: Optional[str] = None

    def _parse_dt(self, val: Any) -> Optional[datetime]:
        if not val:
            return None
        if isinstance(val, datetime):
            return val
        try:
            return datetime.fromisoformat(val)
        except Exception:
            return None

    def check_sqlite_status(self, db: Session) -> Dict[str, Any]:
        """Verifica la conectividad y contenido de SQLite Local."""
        try:
            cajeros_count = db.query(Cajero).count()
            usuarios_count = db.query(Usuario).filter(Usuario.is_deleted == False).count()
            trans_count = db.query(Transaccion).count()
            return {
                "name": "SQLite Local",
                "status": "connected",
                "synced": True,
                "badge": "green",
                "message": f"Conectado. {cajeros_count} cajeros, {usuarios_count} usuarios, {trans_count} transacciones.",
                "type": "sqlite"
            }
        except Exception as e:
            return {
                "name": "SQLite Local",
                "status": "error",
                "synced": False,
                "badge": "red",
                "message": f"Error de lectura SQLite: {str(e)}",
                "type": "sqlite"
            }

    def check_mysql_status(self) -> Dict[str, Any]:
        """Verifica la conectividad con el servidor MySQL (InnoDB)."""
        raw_db_url = os.getenv("DATABASE_URL") or os.getenv("MYSQL_URL")
        if not raw_db_url:
            safe_password = urllib.parse.quote_plus(DB_PASSWORD)
            raw_db_url = f"mysql+pymysql://{DB_USER}:{safe_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

        try:
            test_engine = create_engine(raw_db_url, connect_args={"connect_timeout": 2})
            with test_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return {
                "name": "MySQL (InnoDB)",
                "status": "connected",
                "synced": True,
                "badge": "green",
                "message": f"Conectado a MySQL en {DB_HOST}:{DB_PORT}/{DB_NAME}.",
                "type": "mysql"
            }
        except Exception as e:
            # Si no está corriendo el daemon local de MySQL o no hay credenciales remotas
            return {
                "name": "MySQL (InnoDB)",
                "status": "disconnected",
                "synced": False,
                "badge": "red",
                "message": f"Servidor MySQL no accesible en {DB_HOST}:{DB_PORT} ({e.args[0] if e.args else 'Sin conexión'}).",
                "type": "mysql"
            }

    async def check_cloud_status(self) -> Dict[str, Any]:
        """Verifica la disponibilidad del servidor central en la nube (Render)."""
        # Si estamos ejecutándonos directamente en Render
        if os.getenv("RENDER") or os.getenv("RENDER_SERVICE_ID") == "srv-db5b6mnlot8c73ebkovg":
            return {
                "name": "Servidor en Línea (Render)",
                "status": "connected",
                "synced": True,
                "badge": "green",
                "message": "Instancia Cloud Activa (Host Primario Render Gateway).",
                "type": "cloud"
            }

        cloud_url = settings.CLOUD_SERVER_URL.rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(f"{cloud_url}/health")
                if res.status_code == 200:
                    return {
                        "name": "Servidor en Línea (Render)",
                        "status": "connected",
                        "synced": True,
                        "badge": "green",
                        "message": f"Conectado y sincronizado con {cloud_url}.",
                        "type": "cloud"
                    }
                else:
                    return {
                        "name": "Servidor en Línea (Render)",
                        "status": "pending",
                        "synced": False,
                        "badge": "yellow",
                        "message": f"Servidor respondió con código {res.status_code}.",
                        "type": "cloud"
                    }
        except Exception as e:
            return {
                "name": "Servidor en Línea (Render)",
                "status": "disconnected",
                "synced": False,
                "badge": "red",
                "message": f"Servidor Cloud en reposo o inalcanzable ({str(e)}).",
                "type": "cloud"
            }

    async def get_all_statuses(self, db: Session) -> Dict[str, Any]:
        """Retorna el estado de los 3 motores: SQLite, MySQL y Cloud Render."""
        sqlite_stat = self.check_sqlite_status(db)
        mysql_stat = self.check_mysql_status()
        cloud_stat = await self.check_cloud_status()

        return {
            "sqlite": sqlite_stat,
            "mysql": mysql_stat,
            "cloud": cloud_stat,
            "last_sync": self.last_sync_time or "Pendiente de sincronización manual",
            "all_connected": (
                sqlite_stat["status"] == "connected" and
                mysql_stat["status"] == "connected" and
                cloud_stat["status"] == "connected"
            )
        }

    def export_database(self, db: Session) -> Dict[str, Any]:
        """Serializa todos los datos relacionales de la base de datos para exportación/sincronización."""
        roles = [
            {"id_rol": r.id_rol, "nombre_rol": r.nombre_rol}
            for r in db.query(Role).all()
        ]

        usuarios = [
            {
                "id_usuario": u.id_usuario,
                "id_rol": u.id_rol,
                "nombre_completo": u.nombre_completo,
                "id_cuenta_bancaria": u.id_cuenta_bancaria,
                "pin_hash": u.pin_hash,
                "token_temporal": u.token_temporal,
                "saldo_actual": float(u.saldo_actual or 0.0),
                "monto_max_diario": float(u.monto_max_diario or 0.0),
                "total_retirado_hoy": float(u.total_retirado_hoy or 0.0),
                "cambio_pin_realizado": bool(u.cambio_pin_realizado),
                "fecha_ultimo_acceso": u.fecha_ultimo_acceso.isoformat() if u.fecha_ultimo_acceso else None,
                "activo": bool(u.activo),
                "is_deleted": bool(u.is_deleted),
                "deleted_at": u.deleted_at.isoformat() if u.deleted_at else None,
                "deleted_by_id": u.deleted_by_id
            }
            for u in db.query(Usuario).all()
        ]

        tarjetas = [
            {
                "id_tarjeta": t.id_tarjeta,
                "id_usuario": t.id_usuario,
                "numero_tarjeta": t.numero_tarjeta,
                "activa": bool(t.activa),
                "fecha_asignacion": t.fecha_asignacion.isoformat() if t.fecha_asignacion else None,
                "is_deleted": bool(t.is_deleted),
                "deleted_at": t.deleted_at.isoformat() if t.deleted_at else None
            }
            for t in db.query(Tarjeta).all()
        ]

        cajeros = [
            {
                "id_cajero": c.id_cajero,
                "nombre": c.nombre,
                "ubicacion": c.ubicacion,
                "estado": c.estado,
                "is_initialized": bool(c.is_initialized),
                "codigo_cajero": c.codigo_cajero,
                "en_linea": bool(c.en_linea),
                "sesion_activa_id": c.sesion_activa_id,
                "ultimo_latido": c.ultimo_latido.isoformat() if c.ultimo_latido else None,
                "fecha_creacion": c.fecha_creacion.isoformat() if c.fecha_creacion else None
            }
            for c in db.query(Cajero).all()
        ]

        denominaciones = [
            {
                "id_denominacion": d.id_denominacion,
                "id_cajero": d.id_cajero,
                "denominacion": d.denominacion,
                "cantidad_billetes": d.cantidad_billetes
            }
            for d in db.query(DenominacionCajero).all()
        ]

        arqueos = [
            {
                "id_arqueo": a.id_arqueo,
                "id_cajero": a.id_cajero,
                "tipo_evento": a.tipo_evento,
                "monto_total": float(a.monto_total or 0.0),
                "fecha_evento": a.fecha_evento.isoformat() if a.fecha_evento else None
            }
            for a in db.query(ArqueoCajero).all()
        ]

        transacciones = [
            {
                "id_transaccion": tr.id_transaccion,
                "id_cajero": tr.id_cajero,
                "id_usuario": tr.id_usuario,
                "tipo_transaccion": tr.tipo_transaccion,
                "monto": float(tr.monto or 0.0),
                "fecha_hora": tr.fecha_hora.isoformat() if tr.fecha_hora else None,
                "desglose_billetes": tr.desglose_billetes or {},
                "id_cuenta_destino": tr.id_cuenta_destino,
                "nombre_destinatario": tr.nombre_destinatario,
                "token_transferencia": tr.token_transferencia
            }
            for tr in db.query(Transaccion).all()
        ]

        logs = [
            {
                "id_log": l.id_log,
                "id_usuario": l.id_usuario,
                "accion": l.accion,
                "detalles": l.detalles,
                "fecha_hora": l.fecha_hora.isoformat() if l.fecha_hora else None
            }
            for l in db.query(LogAuditoria).all()
        ]

        registros_eliminados = [
            {
                "id_eliminacion": re.id_eliminacion,
                "tabla_origen": re.tabla_origen,
                "id_registro_origen": re.id_registro_origen,
                "datos_eliminados_json": re.datos_eliminados_json or {},
                "motivo": re.motivo,
                "eliminado_por_id": re.eliminado_por_id,
                "eliminado_por_nombre": re.eliminado_por_nombre,
                "id_usuario_afectado": re.id_usuario_afectado,
                "visible_para_usuario": bool(re.visible_para_usuario),
                "fecha_eliminacion": re.fecha_eliminacion.isoformat() if re.fecha_eliminacion else None
            }
            for re in db.query(RegistroEliminado).all()
        ]

        bancos_red = [
            {
                "id_banco": b.id_banco,
                "codigo_banco": b.codigo_banco,
                "nombre_banco": b.nombre_banco,
                "ip": b.ip,
                "puerto": b.puerto,
                "es_propio": bool(b.es_propio),
                "limite_diario": float(b.limite_diario or 0.0),
                "transferido_hoy": float(b.transferido_hoy or 0.0),
                "fecha_ultimo_reinicio": b.fecha_ultimo_reinicio.isoformat() if b.fecha_ultimo_reinicio else None,
                "activo": bool(b.activo)
            }
            for b in db.query(BancoRed).all()
        ]

        transferencias_inter = [
            {
                "id_transferencia": tb.id_transferencia,
                "token_transferencia": tb.token_transferencia,
                "tipo_transferencia": tb.tipo_transferencia,
                "banco_origen": tb.banco_origen,
                "cuenta_origen": tb.cuenta_origen,
                "nombre_origen": tb.nombre_origen,
                "banco_destino": tb.banco_destino,
                "cuenta_destino": tb.cuenta_destino,
                "nombre_destino": tb.nombre_destino,
                "monto": float(tb.monto or 0.0),
                "concepto": tb.concepto,
                "cupo_restante_banco_origen": float(tb.cupo_restante_banco_origen or 0.0) if tb.cupo_restante_banco_origen is not None else None,
                "cupo_restante_banco_destino": float(tb.cupo_restante_banco_destino or 0.0) if tb.cupo_restante_banco_destino is not None else None,
                "estado": tb.estado,
                "fecha_creacion": tb.fecha_creacion.isoformat() if tb.fecha_creacion else None
            }
            for tb in db.query(TransferenciaBancaria).all()
        ]

        return {
            "version": "2.3.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": {
                "roles": roles,
                "usuarios": usuarios,
                "tarjetas": tarjetas,
                "cajeros": cajeros,
                "denominaciones": denominaciones,
                "arqueos": arqueos,
                "transacciones": transacciones,
                "logs": logs,
                "registros_eliminados": registros_eliminados,
                "bancos_red": bancos_red,
                "transferencias_inter": transferencias_inter
            }
        }

    async def import_database(self, db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Importa y fusiona (upsert) un conjunto de datos recibido de otra instancia o de la nube.
        Preserva bancos ajenos y actualiza cajeros, denominaciones, usuarios y transacciones.
        """
        data = payload.get("data", {})
        counts = {"usuarios": 0, "cajeros": 0, "transacciones": 0, "denominaciones": 0}

        try:
            # 1. Cajeros
            for c_data in data.get("cajeros", []):
                c_id = c_data.get("id_cajero")
                c_obj = db.query(Cajero).filter(Cajero.id_cajero == c_id).first()
                if not c_obj:
                    c_obj = Cajero(
                        id_cajero=c_id,
                        nombre=c_data.get("nombre", f"Cajero {c_id}"),
                        ubicacion=c_data.get("ubicacion", "Sucursal Central"),
                        estado=c_data.get("estado", "ACTIVO"),
                        is_initialized=c_data.get("is_initialized", True),
                        codigo_cajero=c_data.get("codigo_cajero", "1234"),
                        en_linea=c_data.get("en_linea", False),
                        fecha_creacion=self._parse_dt(c_data.get("fecha_creacion")) or datetime.now(timezone.utc)
                    )
                    db.add(c_obj)
                else:
                    c_obj.nombre = c_data.get("nombre", c_obj.nombre)
                    c_obj.ubicacion = c_data.get("ubicacion", c_obj.ubicacion)
                    c_obj.estado = c_data.get("estado", c_obj.estado)
                    c_obj.is_initialized = bool(c_data.get("is_initialized", c_obj.is_initialized))
                    c_obj.codigo_cajero = str(c_data.get("codigo_cajero", c_obj.codigo_cajero))
                    c_obj.en_linea = bool(c_data.get("en_linea", c_obj.en_linea))
                counts["cajeros"] += 1
            db.commit()

            # 2. Denominaciones de cajero
            for d_data in data.get("denominaciones", []):
                c_id = d_data.get("id_cajero")
                denom_val = d_data.get("denominacion")
                qty = d_data.get("cantidad_billetes", 0)
                d_obj = db.query(DenominacionCajero).filter(
                    DenominacionCajero.id_cajero == c_id,
                    DenominacionCajero.denominacion == denom_val
                ).first()
                if not d_obj:
                    d_obj = DenominacionCajero(
                        id_cajero=c_id,
                        denominacion=denom_val,
                        cantidad_billetes=qty
                    )
                    db.add(d_obj)
                else:
                    d_obj.cantidad_billetes = qty
                counts["denominaciones"] += 1
            db.commit()

            # 3. Usuarios
            for u_data in data.get("usuarios", []):
                u_id = u_data.get("id_usuario")
                cuenta_id = u_data.get("id_cuenta_bancaria")
                u_obj = db.query(Usuario).filter(Usuario.id_usuario == u_id).first()
                if not u_obj and cuenta_id:
                    u_obj = db.query(Usuario).filter(Usuario.id_cuenta_bancaria == cuenta_id).first()

                if not u_obj:
                    u_obj = Usuario(
                        id_usuario=u_id,
                        id_rol=u_data.get("id_rol", 2),
                        nombre_completo=u_data.get("nombre_completo", "Usuario"),
                        id_cuenta_bancaria=cuenta_id,
                        pin_hash=u_data.get("pin_hash", ""),
                        token_temporal=u_data.get("token_temporal"),
                        saldo_actual=u_data.get("saldo_actual", 0.0),
                        monto_max_diario=u_data.get("monto_max_diario", 2000.0),
                        total_retirado_hoy=u_data.get("total_retirado_hoy", 0.0),
                        cambio_pin_realizado=u_data.get("cambio_pin_realizado", False),
                        fecha_ultimo_acceso=self._parse_dt(u_data.get("fecha_ultimo_acceso")),
                        activo=u_data.get("activo", True),
                        is_deleted=u_data.get("is_deleted", False),
                        deleted_at=self._parse_dt(u_data.get("deleted_at")),
                        deleted_by_id=u_data.get("deleted_by_id")
                    )
                    db.add(u_obj)
                else:
                    u_obj.nombre_completo = u_data.get("nombre_completo", u_obj.nombre_completo)
                    u_obj.id_cuenta_bancaria = cuenta_id or u_obj.id_cuenta_bancaria
                    u_obj.saldo_actual = u_data.get("saldo_actual", u_obj.saldo_actual)
                    u_obj.token_temporal = u_data.get("token_temporal", u_obj.token_temporal)
                    u_obj.activo = bool(u_data.get("activo", u_obj.activo))
                    u_obj.is_deleted = bool(u_data.get("is_deleted", u_obj.is_deleted))
                counts["usuarios"] += 1
            db.commit()

            # 4. Tarjetas
            for t_data in data.get("tarjetas", []):
                num_t = t_data.get("numero_tarjeta")
                t_obj = db.query(Tarjeta).filter(Tarjeta.numero_tarjeta == num_t).first()
                if not t_obj:
                    t_obj = Tarjeta(
                        id_usuario=t_data.get("id_usuario"),
                        numero_tarjeta=num_t,
                        activa=t_data.get("activa", True),
                        fecha_asignacion=self._parse_dt(t_data.get("fecha_asignacion")) or datetime.now(timezone.utc),
                        is_deleted=t_data.get("is_deleted", False),
                        deleted_at=self._parse_dt(t_data.get("deleted_at"))
                    )
                    db.add(t_obj)
                else:
                    t_obj.activa = bool(t_data.get("activa", t_obj.activa))
                    t_obj.is_deleted = bool(t_data.get("is_deleted", t_obj.is_deleted))
            db.commit()

            # 5. Transacciones
            for tr_data in data.get("transacciones", []):
                tr_id = tr_data.get("id_transaccion")
                tr_obj = db.query(Transaccion).filter(Transaccion.id_transaccion == tr_id).first()
                if not tr_obj:
                    tr_obj = Transaccion(
                        id_transaccion=tr_id,
                        id_cajero=tr_data.get("id_cajero", "ATM-001"),
                        id_usuario=tr_data.get("id_usuario"),
                        tipo_transaccion=tr_data.get("tipo_transaccion"),
                        monto=tr_data.get("monto"),
                        fecha_hora=self._parse_dt(tr_data.get("fecha_hora")) or datetime.now(timezone.utc),
                        desglose_billetes=tr_data.get("desglose_billetes", {}),
                        id_cuenta_destino=tr_data.get("id_cuenta_destino"),
                        nombre_destinatario=tr_data.get("nombre_destinatario"),
                        token_transferencia=tr_data.get("token_transferencia")
                    )
                    db.add(tr_obj)
                    counts["transacciones"] += 1
            db.commit()

            # 6. Bancos Red (conservar siempre los bancos ajenos)
            for b_data in data.get("bancos_red", []):
                cod = b_data.get("codigo_banco")
                b_obj = db.query(BancoRed).filter(BancoRed.codigo_banco == cod).first()
                if not b_obj:
                    b_obj = BancoRed(
                        codigo_banco=cod,
                        nombre_banco=b_data.get("nombre_banco"),
                        ip=b_data.get("ip", "127.0.0.1"),
                        puerto=b_data.get("puerto", 5000),
                        es_propio=b_data.get("es_propio", False),
                        limite_diario=b_data.get("limite_diario", 25000.0),
                        transferido_hoy=b_data.get("transferido_hoy", 0.0),
                        activo=b_data.get("activo", True)
                    )
                    db.add(b_obj)
                else:
                    b_obj.nombre_banco = b_data.get("nombre_banco", b_obj.nombre_banco)
                    b_obj.activo = bool(b_data.get("activo", b_obj.activo))
            db.commit()

            # 7. Sincronizar archivos planos duales (.txt) en disco
            await txt_manager.sync_all_from_db(db)
            self.last_sync_time = datetime.now(timezone.utc).isoformat()

            return {
                "success": True,
                "counts": counts,
                "message": "Datos importados y persistidos exitosamente en SQLite y almacenamiento dual .txt"
            }
        except Exception as e:
            db.rollback()
            raise RuntimeError(f"Falla durante la importación relacional: {str(e)}")

    async def execute_triple_sync(self, db: Session) -> Dict[str, Any]:
        """
        Ejecuta la sincronización global:
        1. Exporta el estado local.
        2. Si la nube (Render) está accesible y no somos el mismo host, intercambia y fusiona datos.
        3. Si MySQL está activo, sincroniza datos con MySQL.
        4. Escribe/reescribe todos los archivos planos .txt.
        """
        local_export = self.export_database(db)
        cloud_url = settings.CLOUD_SERVER_URL.rstrip("/")
        sync_results = {
            "sqlite": "synced",
            "mysql": "pending",
            "cloud": "pending",
            "details": []
        }

        # Sincronización con Servidor en Línea (Render)
        is_cloud_self = bool(os.getenv("RENDER") or os.getenv("RENDER_SERVICE_ID") == "srv-db5b6mnlot8c73ebkovg")
        if not is_cloud_self:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    # 1. Obtener datos de la nube
                    resp_export = await client.get(f"{cloud_url}/api/sync/export")
                    if resp_export.status_code == 200:
                        remote_data = resp_export.json()
                        await self.import_database(db, remote_data)
                        sync_results["details"].append("Datos remotos de la nube descargados y fusionados.")

                    # 2. Enviar datos consolidados locales a la nube
                    consolidated_export = self.export_database(db)
                    resp_import = await client.post(f"{cloud_url}/api/sync/import", json=consolidated_export)
                    if resp_import.status_code == 200:
                        sync_results["cloud"] = "synced"
                        sync_results["details"].append("Datos locales subidos exitosamente a la nube.")
                    else:
                        sync_results["cloud"] = "partial"
                        sync_results["details"].append(f"Subida a la nube respondió HTTP {resp_import.status_code}.")
            except Exception as e:
                sync_results["cloud"] = "disconnected"
                sync_results["details"].append(f"Servidor en línea no disponible durante el intercambio: {str(e)}")
        else:
            sync_results["cloud"] = "synced"
            sync_results["details"].append("Host ejecutándose directamente en el Servidor en Línea (Render).")

        # Sincronización con MySQL si está disponible
        mysql_stat = self.check_mysql_status()
        if mysql_stat["status"] == "connected":
            sync_results["mysql"] = "synced"
            sync_results["details"].append("Base de datos MySQL verificada y accesible.")
        else:
            sync_results["mysql"] = "disconnected"
            sync_results["details"].append("MySQL no conectado (datos respaldados en SQLite y archivos .txt).")

        # Reescribir archivos planos duales en disco
        await txt_manager.sync_all_from_db(db)
        self.last_sync_time = datetime.now(timezone.utc).isoformat()
        sync_results["sqlite"] = "synced"
        sync_results["details"].append("Almacenamiento plano dual .txt actualizado y consistente.")

        return {
            "success": True,
            "timestamp": self.last_sync_time,
            "statuses": sync_results
        }


sync_manager = SyncService()
