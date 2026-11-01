from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Dict, Any

from backend.app.db.database import get_db
from backend.app.services.sync_service import sync_manager

router = APIRouter(prefix="/api/sync", tags=["Sincronización Multibase de Datos"])


@router.get("/status")
async def get_sync_status(db: Session = Depends(get_db)):
    """
    Retorna el estado de conectividad y sincronización de los 3 motores:
    - SQLite Local
    - MySQL (InnoDB)
    - Servidor en Línea (Render)
    """
    try:
        return await sync_manager.get_all_statuses(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo estados de sincronización: {str(e)}")


@router.get("/export")
def export_database_snapshot(db: Session = Depends(get_db)):
    """
    Exporta una instantánea completa de la base de datos para transferir a otro nodo o a la nube.
    """
    try:
        return sync_manager.export_database(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exportando datos: {str(e)}")


@router.post("/import")
async def import_database_snapshot(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Recibe una instantánea de datos y realiza una sincronización de inserción/actualización (upsert).
    """
    try:
        return await sync_manager.import_database(db, payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error importando datos: {str(e)}")


@router.post("/execute")
async def execute_synchronization(db: Session = Depends(get_db)):
    """
    Dispara la sincronización triple: SQLite <-> MySQL <-> Servidor en Línea (Render)
    y reescribe los archivos planos .txt.
    """
    try:
        result = await sync_manager.execute_triple_sync(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error ejecutando sincronización: {str(e)}")
