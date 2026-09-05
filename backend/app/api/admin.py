from typing import Dict
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import Usuario
from backend.app.api.deps import get_current_admin
from backend.app.services.banking_service import BankingService

router = APIRouter(prefix="/api/admin", tags=["Consola Administrativa"])

class VaultInitRequest(BaseModel):
    bills: Dict[str, int] = Field(..., description="Cantidades por denominación para inicialización (máx Q10,000)")

class VaultAddCashRequest(BaseModel):
    bills: Dict[str, int] = Field(..., description="Lote adicional de billetes a recargar (tope acumulado Q30,000)")

class RegisterEmployeeRequest(BaseModel):
    nombre_completo: str
    numero_tarjeta: str
    pin: str
    saldo_inicial: float = 0.0
    monto_max_diario: float = 2000.0

class ReassignCardRequest(BaseModel):
    id_usuario: int
    nueva_tarjeta: str

class AdjustLimitRequest(BaseModel):
    id_usuario: int
    nuevo_limite_diario: float

@router.get("/metrics")
def get_metrics(current_admin: Usuario = Depends(get_current_admin), db: Session = Depends(get_db)):
    return BankingService.get_admin_metrics(db)

@router.post("/vault/initialize")
async def initialize_vault(payload: VaultInitRequest, current_admin: Usuario = Depends(get_current_admin), db: Session = Depends(get_db)):
    return await BankingService.vault_initialize(db, current_admin.id_usuario, payload.bills)

@router.post("/vault/add-cash")
async def add_cash_vault(payload: VaultAddCashRequest, current_admin: Usuario = Depends(get_current_admin), db: Session = Depends(get_db)):
    return await BankingService.vault_add_cash(db, current_admin.id_usuario, payload.bills)

@router.post("/users/register")
async def register_employee(payload: RegisterEmployeeRequest, current_admin: Usuario = Depends(get_current_admin), db: Session = Depends(get_db)):
    return await BankingService.admin_register_employee(
        db, current_admin.id_usuario, payload.nombre_completo, payload.numero_tarjeta,
        payload.pin, payload.saldo_inicial, payload.monto_max_diario
    )

@router.post("/users/reassign-card")
async def reassign_card(payload: ReassignCardRequest, current_admin: Usuario = Depends(get_current_admin), db: Session = Depends(get_db)):
    return await BankingService.admin_reassign_card(db, current_admin.id_usuario, payload.id_usuario, payload.nueva_tarjeta)

@router.post("/users/adjust-limit")
async def adjust_limit(payload: AdjustLimitRequest, current_admin: Usuario = Depends(get_current_admin), db: Session = Depends(get_db)):
    return await BankingService.admin_adjust_limit(db, current_admin.id_usuario, payload.id_usuario, payload.nuevo_limite_diario)