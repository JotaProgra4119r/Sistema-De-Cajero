from typing import Dict
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import Usuario
from backend.app.api.deps import get_current_user
from backend.app.services.banking_service import BankingService
from backend.app.storage_txt.txt_manager import txt_manager

router = APIRouter(prefix="/api/user", tags=["Operaciones de Usuario"])

class WithdrawRequest(BaseModel):
    amount: float = Field(..., description="Monto total escalar solicitado (ej. 123.00, 239.00)")
    bills: Dict[str, int] = Field(..., description="Vector de billetes desglosados por denominación")

class DepositRequest(BaseModel):
    bills: Dict[str, int] = Field(..., description="Vector de piezas introducidas por denominación")

class ChangePinRequest(BaseModel):
    card_number: str
    current_pin: str
    token: str
    new_pin: str

@router.get("/summary")
def get_summary(current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return BankingService.get_user_summary(db, current_user.id_usuario)

@router.post("/withdraw")
async def withdraw_money(payload: WithdrawRequest, current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return await BankingService.withdraw_custom(db, current_user.id_usuario, payload.amount, payload.bills)

@router.post("/deposit")
async def deposit_money(payload: DepositRequest, current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return await BankingService.deposit_custom(db, current_user.id_usuario, payload.bills)

@router.get("/transactions")
async def get_transactions(current_user: Usuario = Depends(get_current_user)):
    """Obtiene directamente de transacciones_historico.txt las últimas 5 transacciones del usuario."""
    return await txt_manager.get_last_transactions(current_user.id_usuario, limit=5)

@router.post("/change-pin")
async def change_pin(payload: ChangePinRequest, current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return await BankingService.change_pin(
        db, current_user.id_usuario, payload.card_number, payload.current_pin, payload.token, payload.new_pin
    )