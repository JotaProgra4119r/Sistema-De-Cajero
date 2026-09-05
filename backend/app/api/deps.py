from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import Usuario
from backend.app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Usuario:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se proveyó token de autorización.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = int(payload["sub"])
    user = db.query(Usuario).filter(Usuario.id_usuario == user_id, Usuario.activo == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado o inactivo.")
    return user

def get_current_admin(current_user: Usuario = Depends(get_current_user)) -> Usuario:
    if current_user.rol.nombre_rol != "ADMINISTRADOR":
        raise HTTPException(status_code=403, detail="Se requieren privilegios de Administrador para esta acción.")
    return current_user