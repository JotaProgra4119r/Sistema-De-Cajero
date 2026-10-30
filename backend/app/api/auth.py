from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import Cajero, DenominacionCajero
from backend.app.services.banking_service import BankingService
from backend.app.core.security import (
    generate_totp_token, invalidate_totp_token, invalidate_jwt_token, decode_access_token
)

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])

class LoginRequest(BaseModel):
    card_number: str = Field(..., description="Número de tarjeta de 16 posiciones")
    pin: str = Field(..., description="PIN confidencial de 4 dígitos")
    token: str = Field(..., description="Token dinámico de 6 dígitos")
    is_admin: bool = Field(False, description="Modo dual: True para consola admin, False para usuario")
    id_cajero: Optional[str] = Field("ATM-001", description="Identificador del cajero terminal")

class LogoutRequest(BaseModel):
    token: Optional[str] = Field(None, description="Token dinámico TOTP a invalidar de inmediato")

@router.post("/login")
def login(payload: LoginRequest, x_atm_id: Optional[str] = Header(None, alias="X-ATM-ID"), db: Session = Depends(get_db)):
    atm_id = payload.id_cajero or x_atm_id or "ATM-001"
    return BankingService.authenticate(
        db, payload.card_number, payload.pin, payload.token, payload.is_admin, id_cajero=atm_id
    )

@router.post("/logout")
def logout(payload: Optional[LogoutRequest] = None, authorization: Optional[str] = Header(None)):
    """
    Cierre de sesión seguro con invalidación inmediata del token TOTP y del JWT.
    Evita que el token pueda volver a ser reutilizado durante los 60s de la ventana temporal.
    """
    purged_tokens = []
    
    if payload and payload.token:
        invalidate_totp_token(payload.token)
        purged_tokens.append(payload.token)

    if authorization and authorization.startswith("Bearer "):
        jwt_token = authorization.split(" ")[1].strip()
        decoded = decode_access_token(jwt_token)
        if decoded:
            totp_in_jwt = decoded.get("totp")
            if totp_in_jwt:
                invalidate_totp_token(totp_in_jwt)
                purged_tokens.append(totp_in_jwt)
        invalidate_jwt_token(jwt_token)

    if not purged_tokens:
        current_token = generate_totp_token()
        invalidate_totp_token(current_token)
        purged_tokens.append(current_token)

    new_active_token = generate_totp_token()
    return {
        "status": "SUCCESS",
        "message": "Sesión finalizada. Token dinámico invalidado y rotado de inmediato.",
        "purged_tokens": list(set(purged_tokens)),
        "new_token": new_active_token
    }

@router.get("/token-preview")
def get_token_preview(id_cajero: Optional[str] = None, x_atm_id: Optional[str] = Header(None, alias="X-ATM-ID"), db: Session = Depends(get_db)):
    """Endpoint de conveniencia para visualizar el token dinámico de seguridad actual y estado de la bóveda del cajero."""
    target_atm = id_cajero or x_atm_id or "ATM-001"
    vault_denoms = db.query(DenominacionCajero).filter(DenominacionCajero.id_cajero == target_atm).all()
    vault_total = sum(d.denominacion * d.cantidad_billetes for d in vault_denoms)
    cajero = db.query(Cajero).filter(Cajero.id_cajero == target_atm).first()

    return {
        "token": generate_totp_token(),
        "expires_in_seconds": 60 - int(__import__("time").time() % 60),
        "id_cajero": target_atm,
        "cajero_nombre": cajero.nombre if cajero else target_atm,
        "vault_total": float(vault_total),
        "vault_empty": vault_total <= 0,
        "is_initialized": cajero.is_initialized if cajero else (vault_total > 0)
    }

@router.get("/atm-status")
def get_atm_status(id_cajero: Optional[str] = None, x_atm_id: Optional[str] = Header(None, alias="X-ATM-ID"), db: Session = Depends(get_db)):
    """Retorna el estado operativo del cajero específico."""
    target_atm = id_cajero or x_atm_id or "ATM-001"
    vault_denoms = db.query(DenominacionCajero).filter(DenominacionCajero.id_cajero == target_atm).all()
    vault_total = sum(d.denominacion * d.cantidad_billetes for d in vault_denoms)
    cajero = db.query(Cajero).filter(Cajero.id_cajero == target_atm).first()

    return {
        "id_cajero": target_atm,
        "cajero_nombre": cajero.nombre if cajero else target_atm,
        "vault_total": float(vault_total),
        "vault_empty": vault_total <= 0,
        "operativo": vault_total > 0,
        "is_initialized": cajero.is_initialized if cajero else (vault_total > 0)
    }

@router.get("/atms")
def list_atms(db: Session = Depends(get_db)):
    """Lista todos los cajeros de la red con su estado de inicialización y fondos."""
    all_cajeros = db.query(Cajero).all()
    res = []
    for c in all_cajeros:
        v_denoms = db.query(DenominacionCajero).filter(DenominacionCajero.id_cajero == c.id_cajero).all()
        v_total = sum(d.denominacion * d.cantidad_billetes for d in v_denoms)
        res.append({
            "id_cajero": c.id_cajero,
            "nombre": c.nombre,
            "ubicacion": c.ubicacion,
            "estado": c.estado,
            "is_initialized": c.is_initialized,
            "vault_total": float(v_total),
            "vault_empty": v_total <= 0
        })
    return res
