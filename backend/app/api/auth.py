from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
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

class LogoutRequest(BaseModel):
    token: Optional[str] = Field(None, description="Token dinámico TOTP a invalidar de inmediato")

@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    return BankingService.authenticate(
        db, payload.card_number, payload.pin, payload.token, payload.is_admin
    )

@router.post("/logout")
def logout(payload: Optional[LogoutRequest] = None, authorization: Optional[str] = Header(None)):
    """
    Cierre de sesión seguro con invalidación inmediata del token TOTP y del JWT.
    Evita que el token pueda volver a ser reutilizado durante los 60s de la ventana temporal.
    """
    purged_tokens = []
    
    # 1. Si se envía token explícito en el body
    if payload and payload.token:
        invalidate_totp_token(payload.token)
        purged_tokens.append(payload.token)

    # 2. Si se envía Bearer JWT en el header Authorization
    if authorization and authorization.startswith("Bearer "):
        jwt_token = authorization.split(" ")[1].strip()
        decoded = decode_access_token(jwt_token)
        if decoded:
            totp_in_jwt = decoded.get("totp")
            if totp_in_jwt:
                invalidate_totp_token(totp_in_jwt)
                purged_tokens.append(totp_in_jwt)
        invalidate_jwt_token(jwt_token)

    # 3. Purga preventiva del token activo actual si no se identificó ninguno específico
    if not purged_tokens:
        current_token = generate_totp_token()
        invalidate_totp_token(current_token)
        purged_tokens.append(current_token)

    return {
        "status": "SUCCESS",
        "message": "Sesión finalizada. Token dinámico invalidado de inmediato en lista negra anti-replay.",
        "purged_tokens": list(set(purged_tokens))
    }

@router.get("/token-preview")
def get_token_preview():
    """Endpoint de conveniencia para visualizar el token dinámico de seguridad actual en el Kiosco."""
    return {
        "token": generate_totp_token(),
        "expires_in_seconds": 60 - int(__import__("time").time() % 60)
    }