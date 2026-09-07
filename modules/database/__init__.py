"""
Módulo de Base de Datos y Persistencia Dual (MySQL InnoDB / SQLite + Archivos Planos).
Sistema Bancario y Cajero Automático Embebido.
"""
from database.connection import Base, engine, SessionLocal, get_db
from database.models import (
    Role,
    Usuario,
    Tarjeta,
    ArqueoCajero,
    DenominacionCajero,
    Transaccion,
    LogAuditoria,
    RegistroEliminado
)

__all__ = [
    "Base",
    "engine",
    "SessionLocal",
    "get_db",
    "Role",
    "Usuario",
    "Tarjeta",
    "ArqueoCajero",
    "DenominacionCajero",
    "Transaccion",
    "LogAuditoria",
    "RegistroEliminado",
]
