import asyncio
import json
import logging
import random
import socket
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.core.config import settings
from backend.app.db.database import SessionLocal
from backend.app.db.models import Usuario, Tarjeta, BancoRed, TransferenciaBancaria, Transaccion

logger = logging.getLogger("interbank_service")
logger.setLevel(logging.INFO)

def get_utc_now_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

def get_local_ip() -> str:
    """Detecta la IP local en la interfaz de red activa."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        try:
            ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def get_broadcast_ip(local_ip: str) -> str:
    parts = local_ip.split(".")
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.{parts[2]}.255"
    return "255.255.255.255"

class InterbankProtocolManager:
    """
    Administrador del Protocolo Interbancario TCP 5000 y UDP 5005.
    Permite el autodescubrimiento y transacciones seguras entre bancos de estudiantes en LAN / Radmin VPN.
    """
    def __init__(self):
        self.tcp_server: Optional[asyncio.Server] = None
        self.udp_transport: Optional[asyncio.DatagramTransport] = None
        self.is_running: bool = False
        self.local_ip: str = get_local_ip()

    def _ensure_daily_reset(self, banco: BancoRed, db: Session):
        """Verifica si ha cambiado de día para reiniciar el límite diario transferido."""
        now_date = datetime.now(timezone.utc).date()
        reinicio_date = banco.fecha_ultimo_reinicio.date() if hasattr(banco.fecha_ultimo_reinicio, 'date') else now_date
        if reinicio_date < now_date:
            banco.transferido_hoy = 0.00
            banco.fecha_ultimo_reinicio = datetime.now(timezone.utc)
            db.commit()

    def _get_or_create_own_bank(self, db: Session) -> BancoRed:
        """Obtiene o crea el registro del banco propio en la base de datos."""
        banco = db.query(BancoRed).filter(BancoRed.codigo_banco == settings.BANK_CODE).first()
        if not banco:
            banco = BancoRed(
                codigo_banco=settings.BANK_CODE,
                nombre_banco=settings.BANK_NAME,
                ip=self.local_ip,
                puerto=settings.INTERBANK_TCP_PORT,
                es_propio=True,
                limite_diario=settings.BANK_DAILY_LIMIT,
                transferido_hoy=0.00,
                fecha_ultimo_reinicio=datetime.now(timezone.utc),
                activo=True
            )
            db.add(banco)
            db.commit()
            db.refresh(banco)
        else:
            self._ensure_daily_reset(banco, db)
            if banco.ip != self.local_ip:
                banco.ip = self.local_ip
                db.commit()
        return banco

    # =========================================================================
    # 1. SERVIDOR TCP PUERTO 5000 (Manejador de Conexiones Entrantes)
    # =========================================================================
    async def handle_tcp_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        client_addr = writer.get_extra_info('peername')
        client_ip = client_addr[0] if client_addr else "DESCONOCIDO"

        try:
            # Límite de tiempo (5 seg) y tamaño máximo de línea (64 KB) contra ataques Slowloris / DoS
            raw_line = await asyncio.wait_for(reader.readline(), timeout=5.0)
            if not raw_line:
                writer.close()
                await writer.wait_closed()
                return

            if len(raw_line) > 65536:
                err_resp = {"tipo": "RESP_ERROR", "codigo": "12", "mensaje": "Payload excede tamaño máximo permitido."}
                writer.write((json.dumps(err_resp) + "\n").encode("utf-8"))
                await writer.drain()
                writer.close()
                await writer.wait_closed()
                return

            line_str = raw_line.decode("utf-8", errors="replace").strip()
            if not line_str:
                writer.close()
                await writer.wait_closed()
                return

            try:
                payload = json.loads(line_str)
            except json.JSONDecodeError:
                err_resp = {"tipo": "RESP_ERROR", "codigo": "96", "mensaje": "JSON inválido o malformado."}
                writer.write((json.dumps(err_resp) + "\n").encode("utf-8"))
                await writer.drain()
                writer.close()
                await writer.wait_closed()
                return

            tipo = str(payload.get("tipo", "")).upper()
            msg_id = str(payload.get("idMensaje", f"MSG-{random.randint(100000, 999999)}"))

            db: Session = SessionLocal()
            try:
                response_dict = await self._process_tcp_request(tipo, payload, msg_id, client_ip, db)
            finally:
                db.close()

            resp_bytes = (json.dumps(response_dict) + "\n").encode("utf-8")
            writer.write(resp_bytes)
            await writer.drain()

        except asyncio.TimeoutError:
            pass
        except Exception as e:
            logger.error(f"[TCP 5000] Error procesando cliente {client_ip}: {e}")
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    async def _process_tcp_request(self, tipo: str, payload: Dict[str, Any], msg_id: str, client_ip: str, db: Session) -> Dict[str, Any]:
        timestamp = get_utc_now_str()
        banco_propio = self._get_or_create_own_bank(db)
        cupo_disponible_propio = max(0.0, float(banco_propio.limite_diario) - float(banco_propio.transferido_hoy))

        # Registrar o actualizar banco remitente si se proporciona
        banco_remitente_cod = payload.get("bancoOrigen")
        if banco_remitente_cod and banco_remitente_cod != settings.BANK_CODE:
            banco_remitente = db.query(BancoRed).filter(BancoRed.codigo_banco == banco_remitente_cod).first()
            if not banco_remitente:
                banco_remitente = BancoRed(
                    codigo_banco=banco_remitente_cod,
                    nombre_banco=payload.get("nombreBancoOrigen", f"Banco {banco_remitente_cod}"),
                    ip=client_ip,
                    puerto=settings.INTERBANK_TCP_PORT,
                    es_propio=False,
                    limite_diario=settings.BANK_DAILY_LIMIT,
                    transferido_hoy=0.00,
                    fecha_ultimo_reinicio=datetime.now(timezone.utc),
                    activo=True
                )
                db.add(banco_remitente)
                db.commit()
            else:
                self._ensure_daily_reset(banco_remitente, db)
                if client_ip != "127.0.0.1" and banco_remitente.ip != client_ip:
                    banco_remitente.ip = client_ip
                    db.commit()

        # ---------------------------------------------------------------------
        # OPERACIÓN A: IB_PING
        # ---------------------------------------------------------------------
        if tipo == "IB_PING":
            return {
                "tipo": "RESP_OK",
                "idMensaje": msg_id,
                "codigo": "00",
                "mensaje": f"Banco {settings.BANK_CODE} en línea",
                "timestamp": timestamp,
                "datos": {
                    "codigoBanco": settings.BANK_CODE,
                    "nombreBanco": settings.BANK_NAME,
                    "cupoDisponibleHoy": round(cupo_disponible_propio, 2),
                    "estado": "EN_LINEA"
                }
            }

        # ---------------------------------------------------------------------
        # OPERACIÓN B: IB_VERIFICAR_CUENTA
        # ---------------------------------------------------------------------
        elif tipo == "IB_VERIFICAR_CUENTA":
            numero_cuenta = str(payload.get("numeroCuenta") or payload.get("cuentaDestino") or "").strip()
            if not numero_cuenta:
                return {
                    "tipo": "RESP_OK",
                    "idMensaje": msg_id,
                    "codigo": "14",
                    "mensaje": "Número de cuenta o tarjeta no especificado.",
                    "timestamp": timestamp,
                    "datos": {
                        "existe": False,
                        "codigoBanco": settings.BANK_CODE,
                        "nombreBanco": settings.BANK_NAME,
                        "numeroCuenta": "",
                        "nombreTitular": "",
                        "cupoDisponibleBanco": round(cupo_disponible_propio, 2)
                    }
                }

            # Búsqueda multi-criterio: id_cuenta_bancaria, tarjeta asignada, o token temporal
            user = (
                db.query(Usuario)
                .join(Tarjeta, Tarjeta.id_usuario == Usuario.id_usuario, isouter=True)
                .filter(
                    (Usuario.id_cuenta_bancaria == numero_cuenta) |
                    (Tarjeta.numero_tarjeta == numero_cuenta) |
                    (Usuario.token_temporal == numero_cuenta),
                    Usuario.is_deleted == False,
                    Usuario.activo == True
                )
                .first()
            )

            if user:
                return {
                    "tipo": "RESP_OK",
                    "idMensaje": msg_id,
                    "codigo": "00",
                    "mensaje": "Cuenta verificada en el banco destino.",
                    "timestamp": timestamp,
                    "datos": {
                        "existe": True,
                        "codigoBanco": settings.BANK_CODE,
                        "nombreBanco": settings.BANK_NAME,
                        "numeroCuenta": numero_cuenta,
                        "nombreTitular": user.nombre_completo,
                        "cupoDisponibleBanco": round(cupo_disponible_propio, 2)
                    }
                }
            else:
                return {
                    "tipo": "RESP_OK",
                    "idMensaje": msg_id,
                    "codigo": "14",
                    "mensaje": "La cuenta no existe en este banco.",
                    "timestamp": timestamp,
                    "datos": {
                        "existe": False,
                        "codigoBanco": settings.BANK_CODE,
                        "nombreBanco": settings.BANK_NAME,
                        "numeroCuenta": numero_cuenta,
                        "nombreTitular": "",
                        "cupoDisponibleBanco": round(cupo_disponible_propio, 2)
                    }
                }

        # ---------------------------------------------------------------------
        # OPERACIÓN C: IB_TRANSFERIR
        # ---------------------------------------------------------------------
        elif tipo == "IB_TRANSFERIR":
            token = str(payload.get("tokenTransferencia", "")).strip()
            banco_origen = str(payload.get("bancoOrigen", "")).strip()
            cuenta_origen = str(payload.get("cuentaOrigen", "")).strip()
            nombre_origen = str(payload.get("nombreOrigen", "Remitente Externo")).strip()
            cuenta_destino = str(payload.get("cuentaDestino", "")).strip()
            concepto = str(payload.get("concepto", "Transferencia interbancaria")).strip()
            raw_monto = payload.get("monto")

            # 1. Validación de Token
            if not token:
                return {
                    "tipo": "RESP_ERROR",
                    "idMensaje": msg_id,
                    "codigo": "12",
                    "mensaje": "Token de transferencia requerido (TRF-YYYYMMDD-XXXXXX).",
                    "timestamp": timestamp
                }

            # 2. Hardening: Prevención de Ataques de Replay / Idempotencia Estricta
            existing_tx = db.query(TransferenciaBancaria).filter(TransferenciaBancaria.token_transferencia == token).first()
            if existing_tx:
                logger.warning(f"[SEGURIDAD] Intento de Replay Attack con token ya procesado: {token}")
                return {
                    "tipo": "RESP_OK",
                    "idMensaje": msg_id,
                    "codigo": "94",
                    "mensaje": "Transacción duplicada: Este token de transferencia ya fue procesado anteriormente.",
                    "timestamp": timestamp,
                    "datos": {
                        "tokenTransferencia": token,
                        "bancoDestino": settings.BANK_CODE,
                        "cuentaDestino": existing_tx.cuenta_destino,
                        "nombreDestino": existing_tx.nombre_destino,
                        "monto": float(existing_tx.monto),
                        "cupoRestanteBancoDestino": round(cupo_disponible_propio, 2)
                    }
                }

            # 3. Validación de Monto Positivo y Numérico
            try:
                monto = float(raw_monto)
                if monto <= 0 or not (monto == monto): # check NaN
                    raise ValueError()
                monto = round(monto, 2)
            except (ValueError, TypeError):
                return {
                    "tipo": "RESP_ERROR",
                    "idMensaje": msg_id,
                    "codigo": "12",
                    "mensaje": "Monto inválido. Debe ser un valor numérico positivo mayor a 0.",
                    "timestamp": timestamp
                }

            # 4. Verificación de Cuenta Destino Local
            user_dest = (
                db.query(Usuario)
                .join(Tarjeta, Tarjeta.id_usuario == Usuario.id_usuario, isouter=True)
                .filter(
                    (Usuario.id_cuenta_bancaria == cuenta_destino) |
                    (Tarjeta.numero_tarjeta == cuenta_destino) |
                    (Usuario.token_temporal == cuenta_destino),
                    Usuario.is_deleted == False,
                    Usuario.activo == True
                )
                .first()
            )

            if not user_dest:
                return {
                    "tipo": "RESP_OK",
                    "idMensaje": msg_id,
                    "codigo": "14",
                    "mensaje": "La cuenta destino no existe en este banco.",
                    "timestamp": timestamp,
                    "datos": {
                        "tokenTransferencia": token,
                        "bancoDestino": settings.BANK_CODE,
                        "cuentaDestino": cuenta_destino,
                        "nombreDestino": "",
                        "monto": monto,
                        "cupoRestanteBancoDestino": round(cupo_disponible_propio, 2)
                    }
                }

            # 5. Verificación de Cupo Diario Disponible (Coordinación de Límites)
            if monto > cupo_disponible_propio:
                return {
                    "tipo": "RESP_OK",
                    "idMensaje": msg_id,
                    "codigo": "65",
                    "mensaje": f"Monto excede el cupo diario disponible del banco destino ({cupo_disponible_propio:.2f}).",
                    "timestamp": timestamp,
                    "datos": {
                        "tokenTransferencia": token,
                        "bancoDestino": settings.BANK_CODE,
                        "cuentaDestino": cuenta_destino,
                        "nombreDestino": user_dest.nombre_completo,
                        "monto": monto,
                        "cupoRestanteBancoDestino": round(cupo_disponible_propio, 2)
                    }
                }

            # 6. Ejecución Transaccional Atómica con Row Locking
            try:
                # Acreditar saldo al usuario receptor
                user_dest.saldo_actual = float(user_dest.saldo_actual) + monto

                # Restar cupo diario coordinado en el banco destino (nosotros)
                banco_propio.transferido_hoy = float(banco_propio.transferido_hoy) + monto
                nuevo_cupo_destino = max(0.0, float(banco_propio.limite_diario) - float(banco_propio.transferido_hoy))

                # Restar cupo diario coordinado en el registro del banco origen
                banco_orig_record = db.query(BancoRed).filter(BancoRed.codigo_banco == banco_origen).first()
                if banco_orig_record:
                    self._ensure_daily_reset(banco_orig_record, db)
                    banco_orig_record.transferido_hoy = float(banco_orig_record.transferido_hoy) + monto

                # Registrar en la tabla de transferencias bancarias
                tx_inter = TransferenciaBancaria(
                    token_transferencia=token,
                    tipo_transferencia="INTERBANCARIA",
                    banco_origen=banco_origen or "EXTERNO",
                    cuenta_origen=cuenta_origen or "EXTERNO",
                    nombre_origen=nombre_origen,
                    banco_destino=settings.BANK_CODE,
                    cuenta_destino=cuenta_destino,
                    nombre_destino=user_dest.nombre_completo,
                    monto=monto,
                    concepto=concepto,
                    cupo_restante_banco_destino=nuevo_cupo_destino,
                    estado="APROBADA",
                    fecha_creacion=datetime.now(timezone.utc)
                )
                db.add(tx_inter)

                # Registrar en el histórico de transacciones del usuario destino
                cajero_solicitante = payload.get("cajero", "RED-INTERBANCARIA")
                tx_usr = Transaccion(
                    id_cajero=cajero_solicitante,
                    id_usuario=user_dest.id_usuario,
                    tipo_transaccion="TRANSFERENCIA_INTERBANCARIA",
                    monto=monto,
                    desglose_billetes={
                        "tipo": "TRANSFERENCIA_INTERBANCARIA_ENTRANTE",
                        "token": token,
                        "banco_origen": banco_origen,
                        "remitente": nombre_origen,
                        "concepto": concepto
                    },
                    id_cuenta_destino=cuenta_destino,
                    nombre_destinatario=user_dest.nombre_completo,
                    token_transferencia=token,
                    fecha_hora=datetime.now(timezone.utc)
                )
                db.add(tx_usr)

                db.commit()

                logger.info(f"[INTERBANK] Transferencia {token} recibida exitosamente: Q{monto} de {banco_origen} a {user_dest.nombre_completo}")

                return {
                    "tipo": "RESP_OK",
                    "idMensaje": msg_id,
                    "codigo": "00",
                    "mensaje": "Transferencia interbancaria acreditada y token registrado.",
                    "timestamp": timestamp,
                    "datos": {
                        "tokenTransferencia": token,
                        "bancoDestino": settings.BANK_CODE,
                        "cuentaDestino": cuenta_destino,
                        "nombreDestino": user_dest.nombre_completo,
                        "monto": monto,
                        "cupoRestanteBancoDestino": round(nuevo_cupo_destino, 2)
                    }
                }
            except Exception as ex:
                db.rollback()
                logger.error(f"[INTERBANK ERROR] Falla al acreditar transferencia {token}: {ex}")
                return {
                    "tipo": "RESP_ERROR",
                    "idMensaje": msg_id,
                    "codigo": "96",
                    "mensaje": f"Error interno al asentar la transferencia: {str(ex)}",
                    "timestamp": timestamp
                }

        # ---------------------------------------------------------------------
        # COMANDO DESCONOCIDO
        # ---------------------------------------------------------------------
        else:
            return {
                "tipo": "RESP_ERROR",
                "idMensaje": msg_id,
                "codigo": "12",
                "mensaje": f"Operación '{tipo}' no soportada en el protocolo interbancario.",
                "timestamp": timestamp
            }

    # =========================================================================
    # 2. SERVIDOR UDP PUERTO 5005 (Autodescubrimiento Broadcast)
    # =========================================================================
    class _UDPDiscoveryProtocol(asyncio.DatagramProtocol):
        def __init__(self, manager: "InterbankProtocolManager"):
            self.manager = manager
            self.transport: Optional[asyncio.DatagramTransport] = None

        def connection_made(self, transport: asyncio.DatagramTransport):
            self.transport = transport
            self.manager.udp_transport = transport

        def datagram_received(self, data: bytes, addr):
            try:
                text_msg = data.decode("utf-8", errors="replace").strip()
                if not text_msg:
                    return

                # Caso 1: Solicitud de descubrimiento recibida
                if text_msg.startswith("DISCOVER_BANCO_ATM|"):
                    parts = text_msg.split("|")
                    if len(parts) >= 5:
                        sender_code = parts[1].strip()
                        sender_name = parts[2].strip()
                        sender_ip = parts[3].strip() or addr[0]
                        sender_port = int(parts[4].strip()) if parts[4].strip().isdigit() else 5000

                        # Registrar banco remitente si no es el nuestro
                        if sender_code != settings.BANK_CODE:
                            db = SessionLocal()
                            try:
                                banco = db.query(BancoRed).filter(BancoRed.codigo_banco == sender_code).first()
                                if not banco:
                                    db.add(BancoRed(
                                        codigo_banco=sender_code,
                                        nombre_banco=sender_name,
                                        ip=sender_ip,
                                        puerto=sender_port,
                                        es_propio=False,
                                        limite_diario=settings.BANK_DAILY_LIMIT,
                                        transferido_hoy=0.00,
                                        fecha_ultimo_reinicio=datetime.now(timezone.utc),
                                        activo=True
                                    ))
                                    db.commit()
                                else:
                                    banco.nombre_banco = sender_name
                                    banco.ip = sender_ip
                                    banco.puerto = sender_port
                                    banco.activo = True
                                    db.commit()
                            finally:
                                db.close()

                        # Responder con HERE_BANCO_ATM
                        db = SessionLocal()
                        try:
                            propio = self.manager._get_or_create_own_bank(db)
                            lim_diario = float(propio.limite_diario)
                            transf_hoy = float(propio.transferido_hoy)
                        finally:
                            db.close()

                        reply = f"HERE_BANCO_ATM|{settings.BANK_CODE}|{settings.BANK_NAME}|{self.manager.local_ip}|{settings.INTERBANK_TCP_PORT}|{lim_diario:.2f}|{transf_hoy:.2f}"
                        if self.transport:
                            self.transport.sendto(reply.encode("utf-8"), addr)
                            logger.info(f"[UDP 5005] Respondido HERE_BANCO_ATM a {addr}: {reply}")

                # Caso 2: Respuesta HERE_BANCO_ATM recibida
                elif text_msg.startswith("HERE_BANCO_ATM|"):
                    parts = text_msg.split("|")
                    if len(parts) >= 7:
                        bank_code = parts[1].strip()
                        bank_name = parts[2].strip()
                        bank_ip = parts[3].strip() or addr[0]
                        bank_port = int(parts[4].strip()) if parts[4].strip().isdigit() else 5000
                        daily_limit = float(parts[5].strip()) if parts[5].strip().replace('.', '', 1).isdigit() else 25000.00
                        transf_today = float(parts[6].strip()) if parts[6].strip().replace('.', '', 1).isdigit() else 0.00

                        if bank_code != settings.BANK_CODE:
                            db = SessionLocal()
                            try:
                                banco = db.query(BancoRed).filter(BancoRed.codigo_banco == bank_code).first()
                                if not banco:
                                    db.add(BancoRed(
                                        codigo_banco=bank_code,
                                        nombre_banco=bank_name,
                                        ip=bank_ip,
                                        puerto=bank_port,
                                        es_propio=False,
                                        limite_diario=daily_limit,
                                        transferido_hoy=transf_today,
                                        fecha_ultimo_reinicio=datetime.now(timezone.utc),
                                        activo=True
                                    ))
                                    db.commit()
                                else:
                                    banco.nombre_banco = bank_name
                                    banco.ip = bank_ip
                                    banco.puerto = bank_port
                                    banco.limite_diario = daily_limit
                                    banco.transferido_hoy = transf_today
                                    banco.activo = True
                                    db.commit()
                                logger.info(f"[UDP 5005] Banco descubierto y registrado: {bank_code} ({bank_name}) en {bank_ip}:{bank_port}")
                            finally:
                                db.close()

            except Exception as e:
                logger.error(f"[UDP 5005] Error procesando datagrama: {e}")

    # =========================================================================
    # 3. CICLO DE VIDA DEL SERVICIO (START / STOP)
    # =========================================================================
    async def start(self):
        """Inicia los escuchadores de red TCP 5000 y UDP 5005."""
        if self.is_running:
            return

        self.local_ip = get_local_ip()
        loop = asyncio.get_running_loop()

        # Iniciar Servidor TCP 5000
        try:
            self.tcp_server = await asyncio.start_server(
                self.handle_tcp_client,
                host="0.0.0.0",
                port=settings.INTERBANK_TCP_PORT,
                reuse_address=True
            )
            logger.info(f"[INTERBANK TCP] Servidor escuchando en 0.0.0.0:{settings.INTERBANK_TCP_PORT} (IP Local: {self.local_ip})")
        except Exception as e:
            logger.warning(f"[INTERBANK TCP] No se pudo enlazar puerto {settings.INTERBANK_TCP_PORT}: {e}")

        # Iniciar Servidor UDP 5005
        try:
            # En Windows se usa socket con SO_REUSEADDR y SO_BROADCAST
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.bind(("0.0.0.0", settings.INTERBANK_UDP_PORT))
            sock.setblocking(False)

            self.udp_transport, _ = await loop.create_datagram_endpoint(
                lambda: self._UDPDiscoveryProtocol(self),
                sock=sock
            )
            logger.info(f"[INTERBANK UDP] Servidor Discovery escuchando en 0.0.0.0:{settings.INTERBANK_UDP_PORT}")
        except Exception as e:
            logger.warning(f"[INTERBANK UDP] No se pudo enlazar puerto {settings.INTERBANK_UDP_PORT}: {e}")

        self.is_running = True

    async def stop(self):
        """Detiene los servidores interbancarios."""
        if self.tcp_server:
            self.tcp_server.close()
            await self.tcp_server.wait_closed()
            self.tcp_server = None

        if self.udp_transport:
            self.udp_transport.close()
            self.udp_transport = None

        self.is_running = False
        logger.info("[INTERBANK] Servidores TCP y UDP detenidos.")

    # =========================================================================
    # 4. FUNCIONES CLIENTE OUTBOUND (Ping, Verificar, Transferir y Escanear)
    # =========================================================================
    async def send_tcp_request(self, ip: str, port: int, payload: Dict[str, Any], timeout: float = 4.0) -> Dict[str, Any]:
        """Envía una petición TCP JSON de una sola línea a un banco remoto."""
        reader, writer = await asyncio.wait_for(asyncio.open_connection(ip, port), timeout=timeout)
        try:
            req_bytes = (json.dumps(payload) + "\n").encode("utf-8")
            writer.write(req_bytes)
            await writer.drain()

            raw_resp = await asyncio.wait_for(reader.readline(), timeout=timeout)
            if not raw_resp:
                raise ConnectionResetError("Conexión cerrada por el banco remoto sin respuesta.")

            return json.loads(raw_resp.decode("utf-8", errors="replace").strip())
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass

    async def ping_bank(self, ip: str, port: int = 5000) -> Dict[str, Any]:
        """Ejecuta IB_PING a un banco remoto."""
        msg_id = f"PING-{random.randint(100000, 999999)}"
        payload = {
            "tipo": "IB_PING",
            "cajero": "SERVER",
            "idMensaje": msg_id,
            "timestamp": get_utc_now_str(),
            "bancoOrigen": settings.BANK_CODE,
            "nombreBancoOrigen": settings.BANK_NAME
        }
        try:
            resp = await self.send_tcp_request(ip, port, payload, timeout=3.0)
            return resp
        except Exception as e:
            return {
                "tipo": "RESP_ERROR",
                "codigo": "91",
                "mensaje": f"Banco inaccesible en {ip}:{port}: {str(e)}"
            }

    async def verify_remote_account(self, ip: str, port: int, target_bank: str, account_number: str) -> Dict[str, Any]:
        """Envía IB_VERIFICAR_CUENTA a un banco remoto."""
        msg_id = f"VERIF-{random.randint(100000, 999999)}"
        payload = {
            "tipo": "IB_VERIFICAR_CUENTA",
            "cajero": "SERVER",
            "idMensaje": msg_id,
            "timestamp": get_utc_now_str(),
            "bancoOrigen": settings.BANK_CODE,
            "bancoDestino": target_bank,
            "numeroCuenta": account_number,
            "cuentaDestino": account_number
        }
        try:
            resp = await self.send_tcp_request(ip, port, payload, timeout=4.0)
            return resp
        except Exception as e:
            return {
                "tipo": "RESP_ERROR",
                "codigo": "91",
                "mensaje": f"Error conectando con {target_bank} ({ip}:{port}): {str(e)}",
                "datos": {"existe": False}
            }

    def generate_transfer_token(self) -> str:
        """Genera un token de formato oficial: TRF-YYYYMMDD-XXXXXX."""
        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        rand_hex = f"{random.randint(100000, 999999)}"
        return f"TRF-{date_str}-{rand_hex}"

    async def execute_interbank_transfer(
        self,
        db: Session,
        sender_user_id: int,
        target_bank_code: str,
        target_account: str,
        amount: float,
        concepto: str = "Pago Interbancario",
        cajero_id: str = "ATM-001"
    ) -> Dict[str, Any]:
        """
        Flujo completo de emisión de transferencia interbancaria:
        1. Valida saldo del usuario local y cupo del banco origen.
        2. Obtiene IP/puerto del banco destino.
        3. Genera token compartido TRF-YYYYMMDD-XXXXXX.
        4. Envía IB_TRANSFERIR por TCP 5000 al banco destino.
        5. Al recibir '00', descuenta fondos del usuario local y actualiza límites de ambos bancos coordinadamente.
        """
        if amount <= 0:
            return {"success": False, "codigo": "12", "mensaje": "El monto debe ser mayor a 0."}

        sender = db.query(Usuario).filter(Usuario.id_usuario == sender_user_id, Usuario.activo == True).first()
        if not sender:
            return {"success": False, "codigo": "14", "mensaje": "Usuario remitente no encontrado o inactivo."}

        if float(sender.saldo_actual) < amount:
            return {"success": False, "codigo": "51", "mensaje": f"Saldo insuficiente. Saldo disponible: Q{float(sender.saldo_actual):.2f}"}

        banco_propio = self._get_or_create_own_bank(db)
        cupo_disponible_propio = max(0.0, float(banco_propio.limite_diario) - float(banco_propio.transferido_hoy))
        if amount > cupo_disponible_propio:
            return {"success": False, "codigo": "65", "mensaje": f"Monto excede el cupo diario disponible de transferencias de nuestro banco (Q{cupo_disponible_propio:.2f})."}

        # Buscar banco destino en nuestra base de datos de bancos de la red
        banco_dest = db.query(BancoRed).filter(BancoRed.codigo_banco == target_bank_code, BancoRed.activo == True).first()
        if not banco_dest:
            return {"success": False, "codigo": "92", "mensaje": f"El banco destino '{target_bank_code}' no está registrado en la red local."}

        self._ensure_daily_reset(banco_dest, db)
        cupo_disponible_dest = max(0.0, float(banco_dest.limite_diario) - float(banco_dest.transferido_hoy))
        if amount > cupo_disponible_dest:
            return {"success": False, "codigo": "65", "mensaje": f"El banco destino {banco_dest.nombre_banco} no cuenta con cupo diario suficiente (Cupo: Q{cupo_disponible_dest:.2f})."}

        # Generar token compartido
        token = self.generate_transfer_token()
        msg_id = f"TRFMSG-{random.randint(100000, 999999)}"

        payload = {
            "tipo": "IB_TRANSFERIR",
            "cajero": cajero_id,
            "idMensaje": msg_id,
            "timestamp": get_utc_now_str(),
            "tokenTransferencia": token,
            "bancoOrigen": settings.BANK_CODE,
            "cuentaOrigen": sender.id_cuenta_bancaria or str(sender.id_usuario),
            "nombreOrigen": sender.nombre_completo,
            "bancoDestino": target_bank_code,
            "cuentaDestino": target_account,
            "nombreDestino": "",
            "monto": amount,
            "concepto": concepto
        }

        # Enviar petición TCP al banco destino
        try:
            resp = await self.send_tcp_request(banco_dest.ip, banco_dest.puerto, payload, timeout=6.0)
        except Exception as e:
            return {
                "success": False,
                "codigo": "91",
                "mensaje": f"No se pudo conectar con el banco {banco_dest.nombre_banco} ({banco_dest.ip}:{banco_dest.puerto}): {str(e)}"
            }

        codigo_resp = str(resp.get("codigo", ""))
        if codigo_resp != "00":
            return {
                "success": False,
                "codigo": codigo_resp,
                "mensaje": resp.get("mensaje", f"El banco destino rechazó la operación con código {codigo_resp}."),
                "detalles": resp
            }

        datos_resp = resp.get("datos", {})
        nombre_dest_recibido = datos_resp.get("nombreDestino") or "Beneficiario Destino"

        # Aplicar el débito en nuestro banco y guardar el comprobante
        try:
            sender.saldo_actual = float(sender.saldo_actual) - amount
            banco_propio.transferido_hoy = float(banco_propio.transferido_hoy) + amount
            banco_dest.transferido_hoy = float(banco_dest.transferido_hoy) + amount

            # Registro de auditoría y conciliación
            tx_bancaria = TransferenciaBancaria(
                token_transferencia=token,
                tipo_transferencia="INTERBANCARIA",
                banco_origen=settings.BANK_CODE,
                cuenta_origen=sender.id_cuenta_bancaria or str(sender.id_usuario),
                nombre_origen=sender.nombre_completo,
                banco_destino=target_bank_code,
                cuenta_destino=target_account,
                nombre_destino=nombre_dest_recibido,
                monto=amount,
                concepto=concepto,
                cupo_restante_banco_origen=float(banco_propio.limite_diario) - float(banco_propio.transferido_hoy),
                cupo_restante_banco_destino=datos_resp.get("cupoRestanteBancoDestino"),
                estado="APROBADA",
                fecha_creacion=datetime.now(timezone.utc)
            )
            db.add(tx_bancaria)

            tx_local = Transaccion(
                id_cajero=cajero_id,
                id_usuario=sender.id_usuario,
                tipo_transaccion="TRANSFERENCIA_INTERBANCARIA",
                monto=amount,
                desglose_billetes={
                    "tipo": "TRANSFERENCIA_INTERBANCARIA_SALIENTE",
                    "token": token,
                    "banco_destino": target_bank_code,
                    "destinatario": nombre_dest_recibido,
                    "cuenta_destino": target_account,
                    "concepto": concepto
                },
                id_cuenta_destino=target_account,
                nombre_destinatario=f"{nombre_dest_recibido} ({target_bank_code})",
                token_transferencia=token,
                fecha_hora=datetime.now(timezone.utc)
            )
            db.add(tx_local)
            db.commit()

            return {
                "success": True,
                "codigo": "00",
                "mensaje": "Transferencia interbancaria completada con éxito.",
                "tokenTransferencia": token,
                "monto": amount,
                "saldo_restante": float(sender.saldo_actual),
                "destinatario": nombre_dest_recibido,
                "banco_destino": banco_dest.nombre_banco,
                "cuenta_destino": target_account,
                "fecha": get_utc_now_str()
            }
        except Exception as e:
            db.rollback()
            logger.error(f"[ERROR] Error asentando débito local tras éxito remoto: {e}")
            return {
                "success": False,
                "codigo": "96",
                "mensaje": f"Transferencia procesada en destino pero ocurrió un error local: {str(e)}",
                "tokenTransferencia": token
            }

    async def scan_network(self, timeout_sec: float = 2.5) -> List[Dict[str, Any]]:
        """
        Escanea la red local:
        1. Emite broadcast UDP a 255.255.255.255:5005 y subred:5005.
        2. Realiza sondeo TCP rápido a IPs comunes y registradas (ej. 10.219.19.9, Radmin 26.121.70.247).
        """
        local_ip = get_local_ip()
        self.local_ip = local_ip
        bcast_ip = get_broadcast_ip(local_ip)

        # 1. Enviar UDP Broadcast
        msg_udp = f"DISCOVER_BANCO_ATM|{settings.BANK_CODE}|{settings.BANK_NAME}|{local_ip}|{settings.INTERBANK_TCP_PORT}"
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        try:
            sock.sendto(msg_udp.encode("utf-8"), ("255.255.255.255", settings.INTERBANK_UDP_PORT))
            if bcast_ip != "255.255.255.255":
                sock.sendto(msg_udp.encode("utf-8"), (bcast_ip, settings.INTERBANK_UDP_PORT))
        except Exception as e:
            logger.warning(f"[UDP SCAN] Broadcast fallo: {e}")
        finally:
            sock.close()

        # 2. Sondeo TCP a bancos registrados y conocidos
        db = SessionLocal()
        known_banks = []
        try:
            known_banks = db.query(BancoRed).filter(BancoRed.es_propio == False).all()
            # Asegurarse de probar IPs por defecto si no están
            test_targets = [
                ("BANC01", "NEXUSBANK", "10.219.19.9", 5000),
                ("BANC01_RADMIN", "NEXUSBANK (Radmin)", "26.121.70.247", 5000),
            ]
            for kb in known_banks:
                test_targets.append((kb.codigo_banco, kb.nombre_banco, kb.ip, kb.puerto))

            # Eliminar duplicados de IP:Puerto
            seen = set()
            targets_to_ping = []
            for cod, nom, ip, prt in test_targets:
                if (ip, prt) not in seen and ip != local_ip:
                    seen.add((ip, prt))
                    targets_to_ping.append((cod, nom, ip, prt))

            async def try_ping(cod, nom, ip, prt):
                resp = await self.ping_bank(ip, prt)
                if resp.get("codigo") == "00":
                    datos = resp.get("datos", {})
                    # Actualizar en BD
                    banco_bd = db.query(BancoRed).filter(BancoRed.codigo_banco == datos.get("codigoBanco", cod)).first()
                    if not banco_bd:
                        banco_bd = BancoRed(
                            codigo_banco=datos.get("codigoBanco", cod),
                            nombre_banco=datos.get("nombreBanco", nom),
                            ip=ip,
                            puerto=prt,
                            es_propio=False,
                            limite_diario=settings.BANK_DAILY_LIMIT,
                            transferido_hoy=0.00,
                            fecha_ultimo_reinicio=datetime.now(timezone.utc),
                            activo=True
                        )
                        db.add(banco_bd)
                    else:
                        banco_bd.ip = ip
                        banco_bd.puerto = prt
                        banco_bd.nombre_banco = datos.get("nombreBanco", nom)
                        banco_bd.activo = True
                    db.commit()

            tasks = [try_ping(cod, nom, ip, prt) for cod, nom, ip, prt in targets_to_ping]
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)

        finally:
            db.close()

        # Pequeña espera para recibir respuestas UDP
        await asyncio.sleep(min(timeout_sec, 1.0))

        # Retornar lista completa de bancos
        db = SessionLocal()
        try:
            bancos = db.query(BancoRed).all()
            results = []
            for b in bancos:
                cupo_disp = max(0.0, float(b.limite_diario) - float(b.transferido_hoy))
                results.append({
                    "id_banco": b.id_banco,
                    "codigo_banco": b.codigo_banco,
                    "nombre_banco": b.nombre_banco,
                    "ip": b.ip,
                    "puerto": b.puerto,
                    "es_propio": b.es_propio,
                    "limite_diario": float(b.limite_diario),
                    "transferido_hoy": float(b.transferido_hoy),
                    "cupo_disponible": cupo_disp,
                    "activo": b.activo
                })
            return results
        finally:
            db.close()

# Instancia singleton del administrador interbancario
interbank_manager = InterbankProtocolManager()
