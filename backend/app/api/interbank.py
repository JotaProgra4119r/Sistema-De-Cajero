from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import Usuario, BancoRed, TransferenciaBancaria
from backend.app.api.deps import get_current_user, get_current_admin
from backend.app.services.interbank_service import interbank_manager
from backend.app.core.config import settings

router = APIRouter(prefix="/api/interbank", tags=["Interbancario (TCP 5000 / UDP 5005)"])

class VerifyAccountRequest(BaseModel):
    bank_code: str = Field(..., description="Código del banco destino (ej. 'BANC01')")
    account_number: str = Field(..., description="Número de cuenta bancaria o tarjeta a verificar")

class InterbankTransferRequest(BaseModel):
    target_bank_code: str = Field(..., description="Código del banco destino (ej. 'BANC01')")
    target_account: str = Field(..., description="Número de cuenta o tarjeta destino")
    amount: float = Field(..., gt=0, description="Monto en Quetzales a transferir")
    concepto: Optional[str] = Field("Transferencia Interbancaria", description="Concepto del pago")
    cajero_id: Optional[str] = Field("ATM-001", description="Identificador del cajero emisor")

class AddBankRequest(BaseModel):
    codigo_banco: str = Field(..., description="Código único (ej. 'BANC01', 'BANC03')")
    nombre_banco: str = Field(..., description="Nombre comercial o descriptivo del banco")
    ip: str = Field(..., description="Dirección IP (LAN o Radmin VPN)")
    puerto: int = Field(5000, description="Puerto TCP interbancario")
    limite_diario: float = Field(25000.00, gt=0, description="Límite diario para transferencias")

@router.get("/status")
def get_interbank_status(db: Session = Depends(get_db)):
    """Retorna el estado de los servidores de red interbancarios locales y configuración del banco."""
    propio = interbank_manager._get_or_create_own_bank(db)
    cupo_disp = max(0.0, float(propio.limite_diario) - float(propio.transferido_hoy))
    return {
        "status": "ONLINE" if interbank_manager.is_running else "STOPPED",
        "codigo_banco": settings.BANK_CODE,
        "nombre_banco": settings.BANK_NAME,
        "ip_local": interbank_manager.local_ip,
        "puerto_tcp": settings.INTERBANK_TCP_PORT,
        "puerto_udp": settings.INTERBANK_UDP_PORT,
        "limite_diario": float(propio.limite_diario),
        "transferido_hoy": float(propio.transferido_hoy),
        "cupo_disponible": round(cupo_disp, 2)
    }

@router.get("/banks")
def list_banks(db: Session = Depends(get_db)):
    """Lista todos los bancos registrados en la red local con su estado y cupos."""
    bancos = db.query(BancoRed).all()
    out = []
    for b in bancos:
        interbank_manager._ensure_daily_reset(b, db)
        cupo_disp = max(0.0, float(b.limite_diario) - float(b.transferido_hoy))
        out.append({
            "id_banco": b.id_banco,
            "codigo_banco": b.codigo_banco,
            "nombre_banco": b.nombre_banco,
            "ip": b.ip,
            "puerto": b.puerto,
            "es_propio": b.es_propio,
            "limite_diario": float(b.limite_diario),
            "transferido_hoy": float(b.transferido_hoy),
            "cupo_disponible": round(cupo_disp, 2),
            "activo": b.activo
        })
    return out

@router.post("/scan")
async def scan_network_banks():
    """Ejecuta el escaneo de red por UDP Broadcast 5005 y sondeo TCP 5000 a la subred."""
    discovered = await interbank_manager.scan_network(timeout_sec=2.0)
    return {
        "mensaje": "Escaneo de red completado exitosamente.",
        "bancos_detectados": discovered
    }

@router.post("/verify")
async def verify_account(req: VerifyAccountRequest, db: Session = Depends(get_db)):
    """Verifica si una cuenta existe en el banco destino antes de enviar una transferencia."""
    # Si es nuestro propio banco, verificar localmente
    if req.bank_code == settings.BANK_CODE:
        resp = await interbank_manager._process_tcp_request(
            "IB_VERIFICAR_CUENTA",
            {"numeroCuenta": req.account_number},
            "LOCAL-VERIF",
            "127.0.0.1",
            db
        )
        return resp

    # Buscar banco remoto
    banco = db.query(BancoRed).filter(BancoRed.codigo_banco == req.bank_code, BancoRed.activo == True).first()
    if not banco:
        raise HTTPException(status_code=404, detail=f"El banco {req.bank_code} no se encuentra registrado en la red.")

    resp = await interbank_manager.verify_remote_account(banco.ip, banco.puerto, req.bank_code, req.account_number)
    return resp

@router.post("/transfer")
async def make_interbank_transfer(
    req: InterbankTransferRequest,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Emite una transferencia interbancaria hacia otro banco de la red:
    1. Verifica fondos locales y límites coordinados.
    2. Envía protocolo TCP IB_TRANSFERIR con token compartido (TRF-YYYYMMDD-XXXXXX).
    3. Asienta débitos y comprobante tanto en origen como en destino.
    """
    res = await interbank_manager.execute_interbank_transfer(
        db=db,
        sender_user_id=current_user.id_usuario,
        target_bank_code=req.target_bank_code,
        target_account=req.target_account,
        amount=req.amount,
        concepto=req.concepto or "Transferencia interbancaria",
        cajero_id=req.cajero_id or "ATM-001"
    )

    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("mensaje", "La transferencia interbancaria fue rechazada.")
        )

    return res

@router.get("/transfers")
def get_transfers_history(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtiene el historial de transferencias interbancarias y sus tokens compartidos."""
    is_admin = current_user.rol.nombre_rol in ["ADMINISTRADOR", "SUPERADMIN", "SUPERADMINISTRADOR"]
    query = db.query(TransferenciaBancaria)

    if not is_admin:
        # El usuario sólo ve las transferencias donde él es emisor o receptor
        query = query.filter(
            (TransferenciaBancaria.cuenta_origen == current_user.id_cuenta_bancaria) |
            (TransferenciaBancaria.cuenta_destino == current_user.id_cuenta_bancaria) |
            (TransferenciaBancaria.cuenta_origen == str(current_user.id_usuario)) |
            (TransferenciaBancaria.cuenta_destino == str(current_user.id_usuario))
        )

    records = query.order_by(TransferenciaBancaria.fecha_creacion.desc()).limit(100).all()
    out = []
    for r in records:
        out.append({
            "id_transferencia": r.id_transferencia,
            "token_transferencia": r.token_transferencia,
            "tipo_transferencia": r.tipo_transferencia,
            "banco_origen": r.banco_origen,
            "cuenta_origen": r.cuenta_origen,
            "nombre_origen": r.nombre_origen,
            "banco_destino": r.banco_destino,
            "cuenta_destino": r.cuenta_destino,
            "nombre_destino": r.nombre_destino,
            "monto": float(r.monto),
            "concepto": r.concepto,
            "cupo_restante_banco_origen": float(r.cupo_restante_banco_origen) if r.cupo_restante_banco_origen is not None else None,
            "cupo_restante_banco_destino": float(r.cupo_restante_banco_destino) if r.cupo_restante_banco_destino is not None else None,
            "estado": r.estado,
            "fecha_creacion": r.fecha_creacion.isoformat() if r.fecha_creacion else None
        })
    return out

@router.post("/banks/upsert")
def upsert_bank(
    req: AddBankRequest,
    current_admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Registra o actualiza manualmente la IP y datos de un banco en la red."""
    banco = db.query(BancoRed).filter(BancoRed.codigo_banco == req.codigo_banco).first()
    if not banco:
        banco = BancoRed(
            codigo_banco=req.codigo_banco,
            nombre_banco=req.nombre_banco,
            ip=req.ip,
            puerto=req.puerto,
            es_propio=(req.codigo_banco == settings.BANK_CODE),
            limite_diario=req.limite_diario,
            transferido_hoy=0.00,
            activo=True
        )
        db.add(banco)
    else:
        banco.nombre_banco = req.nombre_banco
        banco.ip = req.ip
        banco.puerto = req.puerto
        banco.limite_diario = req.limite_diario
        banco.activo = True

    db.commit()
    db.refresh(banco)
    return {
        "mensaje": f"Banco {banco.codigo_banco} registrado/actualizado exitosamente.",
        "banco": {
            "codigo_banco": banco.codigo_banco,
            "nombre_banco": banco.nombre_banco,
            "ip": banco.ip,
            "puerto": banco.puerto,
            "limite_diario": float(banco.limite_diario)
        }
    }
