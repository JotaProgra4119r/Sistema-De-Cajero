from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from backend.app.db.database import Base

class Role(Base):
    __tablename__ = "roles"
    
    id_rol = Column(Integer, primary_key=True, autoincrement=True)
    nombre_rol = Column(String(20), unique=True, nullable=False)
    usuarios = relationship("Usuario", back_populates="rol")

class Usuario(Base):
    __tablename__ = "usuarios"
    
    id_usuario = Column(Integer, primary_key=True, autoincrement=True)
    id_rol = Column(Integer, ForeignKey("roles.id_rol"), nullable=False)
    nombre_completo = Column(String(100), nullable=False)
    pin_hash = Column(String(60), nullable=False)
    token_temporal = Column(String(10), nullable=True)
    saldo_actual = Column(Numeric(12, 2), default=0.00, nullable=False)
    monto_max_diario = Column(Numeric(12, 2), default=2000.00, nullable=False)
    total_retirado_hoy = Column(Numeric(12, 2), default=0.00, nullable=False)
    fecha_ultimo_acceso = Column(DateTime, nullable=True)
    cambio_pin_realizado = Column(Boolean, default=False, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    
    rol = relationship("Role", back_populates="usuarios")
    tarjetas = relationship("Tarjeta", back_populates="usuario", cascade="all, delete-orphan")
    transacciones = relationship("Transaccion", back_populates="usuario")

class Tarjeta(Base):
    __tablename__ = "tarjetas"
    
    id_tarjeta = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)
    numero_tarjeta = Column(String(16), unique=True, nullable=False)
    activa = Column(Boolean, default=True, nullable=False)
    fecha_emision = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    usuario = relationship("Usuario", back_populates="tarjetas")

class DenominacionCajero(Base):
    __tablename__ = "denominaciones_cajero"
    
    denominacion = Column(Integer, primary_key=True)
    cantidad_billetes = Column(Integer, default=0, nullable=False)

class ArqueoCajero(Base):
    __tablename__ = "arqueos_cajero"
    
    id_arqueo = Column(Integer, primary_key=True, autoincrement=True)
    tipo_evento = Column(String(20), nullable=False) # INICIALIZACION, RECARGA
    monto_total = Column(Numeric(12, 2), nullable=False)
    fecha_evento = Column(DateTime, default=datetime.utcnow, nullable=False)

class Transaccion(Base):
    __tablename__ = "transacciones"
    
    id_transaccion = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)
    tipo_transaccion = Column(String(20), nullable=False) # RETIRO, DEPOSITO
    monto = Column(Numeric(12, 2), nullable=False)
    fecha_hora = Column(DateTime, default=datetime.utcnow, nullable=False)
    desglose_billetes = Column(JSON, nullable=False)
    
    usuario = relationship("Usuario", back_populates="transacciones")

class LogAuditoria(Base):
    __tablename__ = "logs_auditoria"
    
    id_log = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(Integer, nullable=True)
    accion = Column(String(100), nullable=False)
    detalles = Column(Text, nullable=True)
    fecha_hora = Column(DateTime, default=datetime.utcnow, nullable=False)