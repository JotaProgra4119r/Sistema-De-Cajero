from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, JSON, Text
)
from sqlalchemy.orm import relationship
from database.connection import Base

def utc_now():
    return datetime.now(timezone.utc)

class Role(Base):
    __tablename__ = "roles"

    id_rol = Column(Integer, primary_key=True, autoincrement=True)
    nombre_rol = Column(String(50), unique=True, nullable=False)

    usuarios = relationship("Usuario", back_populates="rol")

class Usuario(Base):
    __tablename__ = "usuarios"

    id_usuario = Column(Integer, primary_key=True, autoincrement=True)
    id_rol = Column(Integer, ForeignKey("roles.id_rol"), nullable=False)
    nombre_completo = Column(String(100), nullable=False)
    id_cuenta_bancaria = Column(String(20), unique=True, nullable=True)  # Token / ID de Cuenta de al menos 8 dígitos
    pin_hash = Column(String(255), nullable=False)
    token_temporal = Column(String(10), nullable=True)
    saldo_actual = Column(Numeric(12, 2), default=0.00, nullable=False)
    monto_max_diario = Column(Numeric(12, 2), default=2000.00, nullable=False)
    total_retirado_hoy = Column(Numeric(12, 2), default=0.00, nullable=False)
    cambio_pin_realizado = Column(Boolean, default=False, nullable=False)
    fecha_ultimo_acceso = Column(DateTime, nullable=True)
    activo = Column(Boolean, default=True, nullable=False)

    # Soft Delete Audit Attributes
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by_id = Column(Integer, nullable=True)

    rol = relationship("Role", back_populates="usuarios")
    tarjetas = relationship("Tarjeta", back_populates="usuario")
    transacciones = relationship("Transaccion", back_populates="usuario")

    @property
    def is_active(self) -> bool:
        return bool(self.activo) and not bool(self.is_deleted)

    @is_active.setter
    def is_active(self, value: bool):
        self.activo = bool(value)

class Tarjeta(Base):
    __tablename__ = "tarjetas"

    id_tarjeta = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)
    numero_tarjeta = Column(String(16), unique=True, nullable=False)
    activa = Column(Boolean, default=True, nullable=False)
    fecha_asignacion = Column(DateTime, default=utc_now, nullable=False)

    # Soft Delete Audit Attributes
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    usuario = relationship("Usuario", back_populates="tarjetas")

class Cajero(Base):
    """Modelo relacional de Cajeros Automáticos (ATM Terminals) en la Red Bancaria."""
    __tablename__ = "cajeros"

    id_cajero = Column(String(20), primary_key=True)  # ej. "ATM-001", "ATM-002", "ATM-003"
    nombre = Column(String(100), nullable=False)
    ubicacion = Column(String(150), nullable=True)
    estado = Column(String(20), default="ACTIVO", nullable=False)  # ACTIVO | FUERA_DE_SERVICIO | MANTENIMIENTO
    is_initialized = Column(Boolean, default=False, nullable=False)
    fecha_creacion = Column(DateTime, default=utc_now, nullable=False)

    denominaciones = relationship("DenominacionCajero", back_populates="cajero")

class ArqueoCajero(Base):
    __tablename__ = "arqueos_cajero"

    id_arqueo = Column(Integer, primary_key=True, autoincrement=True)
    id_cajero = Column(String(20), default="ATM-001", nullable=False)
    tipo_evento = Column(String(30), nullable=False)  # INICIALIZACION | RECARGA | RESET
    monto_total = Column(Numeric(12, 2), nullable=False)
    fecha_evento = Column(DateTime, default=utc_now, nullable=False)

class DenominacionCajero(Base):
    __tablename__ = "denominaciones_cajero"

    id_denominacion = Column(Integer, primary_key=True, autoincrement=True)
    id_cajero = Column(String(20), ForeignKey("cajeros.id_cajero"), default="ATM-001", nullable=False)
    denominacion = Column(Integer, nullable=False)
    cantidad_billetes = Column(Integer, default=0, nullable=False)

    cajero = relationship("Cajero", back_populates="denominaciones")

class Transaccion(Base):
    __tablename__ = "transacciones"

    id_transaccion = Column(Integer, primary_key=True, autoincrement=True)
    id_cajero = Column(String(20), default="ATM-001", nullable=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)
    tipo_transaccion = Column(String(30), nullable=False)  # RETIRO | DEPOSITO | DEPOSITO_A_TERCERO
    monto = Column(Numeric(12, 2), nullable=False)
    fecha_hora = Column(DateTime, default=utc_now, nullable=False)
    desglose_billetes = Column(JSON, nullable=False)
    id_cuenta_destino = Column(String(20), nullable=True)  # ID de 8 dígitos de la cuenta que recibió la acreditación
    nombre_destinatario = Column(String(100), nullable=True)  # Nombre del titular destinatario

    usuario = relationship("Usuario", back_populates="transacciones")

class LogAuditoria(Base):
    __tablename__ = "logs_auditoria"

    id_log = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(Integer, nullable=True)
    accion = Column(String(100), nullable=False)
    detalles = Column(Text, nullable=True)
    fecha_hora = Column(DateTime, default=utc_now, nullable=False)

class RegistroEliminado(Base):
    """
    Bitácora estricta e inmutable de eliminaciones lógicas (Soft Delete).
    Almacena los datos serializados en JSON del registro dado de baja,
    el motivo, el autor de la baja, y si es visible para el usuario final en su panel.
    """
    __tablename__ = "registros_eliminados"

    id_eliminacion = Column(Integer, primary_key=True, autoincrement=True)
    tabla_origen = Column(String(50), nullable=False)  # usuarios | tarjetas | transacciones
    id_registro_origen = Column(Integer, nullable=False)
    datos_eliminados_json = Column(JSON, nullable=False)
    motivo = Column(String(255), nullable=True)
    eliminado_por_id = Column(Integer, nullable=True)
    eliminado_por_nombre = Column(String(100), nullable=True)
    id_usuario_afectado = Column(Integer, nullable=True)
    visible_para_usuario = Column(Boolean, default=True, nullable=False)
    fecha_eliminacion = Column(DateTime, default=utc_now, nullable=False)
