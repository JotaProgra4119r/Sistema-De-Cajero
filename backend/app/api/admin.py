from typing import Dict, Optional
from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import Usuario, Cajero
from backend.app.api.deps import get_current_admin, get_current_superadmin
from backend.app.services.banking_service import BankingService

router = APIRouter(prefix="/api/admin", tags=["Consola Administrativa"])

class VaultInitRequest(BaseModel):
    bills: Dict[str, int] = Field(..., description="Cantidades por denominación para inicialización (máx Q10,000)")
    id_cajero: Optional[str] = Field(None, description="Identificador del cajero a inicializar (opcional)")

class VaultInitAllRequest(BaseModel):
    bills: Optional[Dict[str, int]] = Field(None, description="Lote de billetes con el que inicializar todos los cajeros simultáneamente")

class VaultAddCashRequest(BaseModel):
    bills: Dict[str, int] = Field(..., description="Lote adicional de billetes a recargar (tope acumulado Q30,000)")
    id_cajero: Optional[str] = Field(None, description="Identificador del cajero a recargar (opcional)")

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

class AdminChangePinRequest(BaseModel):
    id_usuario: int
    nuevo_pin: str = Field(..., min_length=4, max_length=4, description="Nuevo PIN numérico de 4 dígitos")

class SoftDeleteUserRequest(BaseModel):
    id_usuario: int
    motivo: str = "Baja solicitada por administración"

class SoftDeleteCajeroRequest(BaseModel):
    motivo: Optional[str] = "Baja y depuración de terminal solicitada desde Consola Superadmin"

@router.get("/metrics")
def get_metrics(
    x_atm_id: Optional[str] = Header(None, alias="X-ATM-ID"),
    current_admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    atm_id = x_atm_id or "ATM-001"
    return BankingService.get_admin_metrics(db, id_cajero=atm_id)

@router.get("/super/metrics")
def get_superadmin_metrics(
    current_superadmin: Usuario = Depends(get_current_superadmin),
    db: Session = Depends(get_db)
):
    """Métricas maestras de red global multicajero exclusivas para la consola de Superadministración."""
    return BankingService.get_superadmin_metrics(db)

@router.get("/super/cajero/{id_cajero}/detalles")
def get_superadmin_cajero_details(
    id_cajero: str,
    current_superadmin: Usuario = Depends(get_current_superadmin),
    db: Session = Depends(get_db)
):
    """Despliegue profundo e individual de un cajero específico para el Superagente/Superadministrador."""
    return BankingService.get_cajero_detailed_report(db, id_cajero)

@router.get("/super/reporte-consolidado")
def get_superadmin_consolidated_report(
    current_superadmin: Usuario = Depends(get_current_superadmin),
    db: Session = Depends(get_db)
):
    """Genera dataset para el Certificado y Reporte Consolidado Imprimible de toda la Red Multicajero."""
    return BankingService.get_superadmin_consolidated_report(db)

@router.post("/super/cajeros/{id_cajero}/delete")
async def soft_delete_cajero_route(
    id_cajero: str,
    payload: Optional[SoftDeleteCajeroRequest] = None,
    current_superadmin: Usuario = Depends(get_current_superadmin),
    db: Session = Depends(get_db)
):
    """Baja lógica de una terminal cajero con preservación forense en tabla registros_eliminados y archivos .txt."""
    motivo = payload.motivo if payload and payload.motivo else "Baja y depuración de terminal solicitada desde Consola Superadmin"
    return await BankingService.soft_delete_cajero(db, current_superadmin.id_usuario, id_cajero, motivo)

@router.post("/super/cajeros/{id_cajero}/restore")
async def restore_cajero_route(
    id_cajero: str,
    current_superadmin: Usuario = Depends(get_current_superadmin),
    db: Session = Depends(get_db)
):
    """Restaura una terminal cajero dada de baja lógicamente."""
    return await BankingService.restore_cajero(db, current_superadmin.id_usuario, id_cajero)

@router.get("/super/cajeros/deleted")
def get_deleted_cajeros_route(
    current_superadmin: Usuario = Depends(get_current_superadmin),
    db: Session = Depends(get_db)
):
    """Lista las terminales dadas de baja en la red bancaria."""
    return BankingService.get_deleted_cajeros(db)

@router.post("/vault/initialize")
async def initialize_vault(
    payload: VaultInitRequest,
    x_atm_id: Optional[str] = Header(None, alias="X-ATM-ID"),
    current_admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    atm_id = payload.id_cajero or x_atm_id or "ATM-001"
    return await BankingService.vault_initialize(db, current_admin.id_usuario, payload.bills, id_cajero=atm_id)

@router.post("/vault/initialize-all")
async def initialize_all_vaults(
    payload: Optional[VaultInitAllRequest] = None,
    current_superadmin: Usuario = Depends(get_current_superadmin),
    db: Session = Depends(get_db)
):
    """Acción de Superadministrador para inicializar simultáneamente todos los cajeros de la red."""
    bills = payload.bills if payload else None
    return await BankingService.vault_initialize_all(db, current_superadmin.id_usuario, bills=bills)

@router.post("/vault/add-cash")
async def add_cash_vault(
    payload: VaultAddCashRequest,
    x_atm_id: Optional[str] = Header(None, alias="X-ATM-ID"),
    current_admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    atm_id = payload.id_cajero or x_atm_id or "ATM-001"
    return await BankingService.vault_add_cash(db, current_admin.id_usuario, payload.bills, id_cajero=atm_id)

@router.post("/vault/reset")
async def reset_vault(
    id_cajero: Optional[str] = None,
    x_atm_id: Optional[str] = Header(None, alias="X-ATM-ID"),
    current_admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Restablece la bóveda y variables de un cajero individual a cero (Q0.00)."""
    atm_id = id_cajero or x_atm_id or "ATM-001"
    return await BankingService.vault_reset(db, current_admin.id_usuario, id_cajero=atm_id)

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

@router.post("/users/change-pin")
async def admin_change_pin(payload: AdminChangePinRequest, current_admin: Usuario = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Permite al administrador modificar o asignar un nuevo PIN confidencial a un usuario."""
    return await BankingService.admin_change_pin(db, current_admin.id_usuario, payload.id_usuario, payload.nuevo_pin)

@router.delete("/users/{user_id}")
async def soft_delete_user_by_id(user_id: int, motivo: str = "Baja administrativa", current_admin: Usuario = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Ejecuta baja lógica estricta sin destrucción física de datos."""
    return await BankingService.soft_delete_user(db, current_admin.id_usuario, user_id, motivo)

@router.post("/users/soft-delete")
async def soft_delete_user_post(payload: SoftDeleteUserRequest, current_admin: Usuario = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Ruta POST alternativa para baja lógica desde paneles y clientes HTTP."""
    return await BankingService.soft_delete_user(db, current_admin.id_usuario, payload.id_usuario, payload.motivo)

@router.get("/audit/deleted-records")
def get_all_deleted_records(current_admin: Usuario = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Retorna el inventario consolidado de registros y cuentas dadas de baja lógicamente."""
    return BankingService.get_all_deleted_records(db)
