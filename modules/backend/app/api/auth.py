from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.services.banking_service import BankingService
from backend.app.core.security import generate_totp_token

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])

class LoginRequest(BaseModel):
    card_number: str = Field(..., description="Número de tarjeta de 16 posiciones")
    pin: str = Field(..., description="PIN confidencial de 4 dígitos")
    token: str = Field(..., description="Token dinámico de 6 dígitos")
    is_admin: bool = Field(False, description="Modo dual: True para consola admin, False para usuario")

@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    return BankingService.authenticate(
        db, payload.card_number, payload.pin, payload.token, payload.is_admin
    )

@router.get("/token-preview")
def get_token_preview():
    """Endpoint de conveniencia para visualizar el token dinámico de seguridad actual en el Kiosco."""
    return {
        "token": generate_totp_token(),
        "expires_in_seconds": 60 - int(__import__("time").time() % 60)
    }