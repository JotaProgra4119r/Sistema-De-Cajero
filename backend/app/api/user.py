from typing import Dict, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import Usuario, DenominacionCajero
from backend.app.api.deps import get_current_user
from backend.app.services.banking_service import BankingService
from backend.app.storage_txt.txt_manager import txt_manager

router = APIRouter(prefix="/api/user", tags=["Operaciones de Usuario"])

class WithdrawRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Monto total escalar solicitado (ej. 123.00, 239.00)")
    bills: Dict[str, int] = Field(default_factory=dict, description="Vector de billetes desglosados (opcional si se usa cálculo automático)")

class CalculateBreakdownRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Monto en Quetzales a desglosar")

class DepositRequest(BaseModel):
    bills: Dict[str, int] = Field(..., description="Vector de piezas introducidas por denominación")

class DepositToAccountRequest(BaseModel):
    id_cuenta_destino: str = Field(..., min_length=8, description="ID numérico de la cuenta destino (al menos 8 dígitos)")
    bills: Dict[str, int] = Field(..., description="Vector de piezas físicas a depositar por denominación")

class ChangePinRequest(BaseModel):
    card_number: str
    current_pin: str
    token: str = ""
    new_pin: str

@router.get("/summary")
def get_summary(
    current_user: Usuario = Depends(get_current_user),
    x_atm_id: Optional[str] = Header(None, alias="X-ATM-ID"),
    db: Session = Depends(get_db)
):
    atm_id = x_atm_id or "ATM-001"
    return BankingService.get_user_summary(db, current_user.id_usuario, id_cajero=atm_id)

@router.post("/withdraw")
async def withdraw_money(
    payload: WithdrawRequest,
    current_user: Usuario = Depends(get_current_user),
    x_atm_id: Optional[str] = Header(None, alias="X-ATM-ID"),
    db: Session = Depends(get_db)
):
    atm_id = x_atm_id or "ATM-001"
    return await BankingService.withdraw_custom(db, current_user.id_usuario, payload.amount, payload.bills, id_cajero=atm_id)

@router.post("/calculate-breakdown")
def calculate_breakdown(
    payload: CalculateBreakdownRequest,
    x_atm_id: Optional[str] = Header(None, alias="X-ATM-ID"),
    db: Session = Depends(get_db)
):
    atm_id = x_atm_id or "ATM-001"
    vault_records = db.query(DenominacionCajero).filter(DenominacionCajero.id_cajero == atm_id).all()
    stock_map = {d.denominacion: d.cantidad_billetes for d in vault_records}
    breakdown = BankingService.calculate_optimal_dispense(int(payload.amount), stock_map)
    if breakdown is None:
        raise HTTPException(
            status_code=400,
            detail=f"Inventario físico insuficiente en {atm_id}: No es posible dispensar Q{payload.amount:.2f} con las existencias de este cajero."
        )
    return {
        "amount": payload.amount,
        "breakdown": breakdown,
        "id_cajero": atm_id,
        "status": "FEASIBLE"
    }

@router.post("/deposit")
async def deposit_money(
    payload: DepositRequest,
    current_user: Usuario = Depends(get_current_user),
    x_atm_id: Optional[str] = Header(None, alias="X-ATM-ID"),
    db: Session = Depends(get_db)
):
    atm_id = x_atm_id or "ATM-001"
    return await BankingService.deposit_custom(db, current_user.id_usuario, payload.bills, id_cajero=atm_id)

@router.get("/lookup-account")
def lookup_account(
    account_id: str = Query(..., description="ID de cuenta de 8 dígitos a consultar"),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verifica y consulta el nombre del titular para un depósito a terceros por su ID de 8 dígitos."""
    return BankingService.lookup_account(db, account_id)

@router.post("/deposit-to-account")
async def deposit_to_account(
    payload: DepositToAccountRequest,
    current_user: Usuario = Depends(get_current_user),
    x_atm_id: Optional[str] = Header(None, alias="X-ATM-ID"),
    db: Session = Depends(get_db)
):
    """
    Efectúa un depósito en efectivo a otra cuenta bancaria en la red (interbancario/entre cajeros)
    usando el ID de al menos 8 dígitos de la persona receptora.
    """
    atm_id = x_atm_id or "ATM-001"
    return await BankingService.deposit_to_third_party(
        db, current_user.id_usuario, payload.id_cuenta_destino, payload.bills, id_cajero=atm_id
    )

@router.get("/transactions")
def get_transactions(current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    """Obtiene las transacciones recientes del usuario con desglose, cajero y datos de destinatario."""
    from backend.app.db.models import Transaccion
    txs = db.query(Transaccion).filter(Transaccion.id_usuario == current_user.id_usuario).order_by(Transaccion.fecha_hora.desc()).limit(10).all()
    res = []
    for t in txs:
        res.append({
            "id_transaccion": t.id_transaccion,
            "id_cajero": t.id_cajero or "ATM-001",
            "id_usuario": t.id_usuario,
            "tipo": t.tipo_transaccion,
            "monto": float(t.monto),
            "desglose": t.desglose_billetes,
            "id_cuenta_destino": t.id_cuenta_destino,
            "nombre_destinatario": t.nombre_destinatario,
            "fecha_hora": t.fecha_hora.strftime("%Y-%m-%d %H:%M:%S") if t.fecha_hora else ""
        })
    return res

@router.post("/change-pin")
async def change_pin(payload: ChangePinRequest, current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return await BankingService.change_pin(
        db, current_user.id_usuario, payload.card_number, payload.current_pin, payload.new_pin, payload.token
    )

@router.get("/audit/deleted-records")
def get_my_deleted_records(current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    """Permite al usuario consultar el historial transparente de tarjetas o registros desactivados/dados de baja que le pertenecen."""
    return BankingService.get_user_deleted_records(db, current_user.id_usuario)
