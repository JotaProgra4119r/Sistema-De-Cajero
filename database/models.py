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
    codigo_cajero = Column(String(10), default="1234", nullable=False)  # Código/PIN de 4 dígitos para inicio del cajero
    en_linea = Column(Boolean, default=False, nullable=False)  # True si el cajero está encendido/en sesión activa
    sesion_activa_id = Column(String(100), nullable=True)  # Token identificador de sesión única activa
    ultimo_latido = Column(DateTime, nullable=True)  # Timestamp de último heartbeat de la terminal
    fecha_creacion = Column(DateTime, default=utc_now, nullable=False)

    # Soft Delete Audit Attributes (Baja lógica y aislamiento)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by_id = Column(Integer, nullable=True)

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
    tipo_transaccion = Column(String(30), nullable=False)  # RETIRO | DEPOSITO | DEPOSITO_A_TERCERO | TRANSFERENCIA_INTERBANCARIA
    monto = Column(Numeric(12, 2), nullable=False)
    fecha_hora = Column(DateTime, default=utc_now, nullable=False)
    desglose_billetes = Column(JSON, nullable=False)
    id_cuenta_destino = Column(String(20), nullable=True)  # ID de 8 dígitos de la cuenta que recibió la acreditación
    nombre_destinatario = Column(String(100), nullable=True)  # Nombre del titular destinatario
    token_transferencia = Column(String(40), nullable=True, index=True)  # Token compartido ej: 'TRF-20261029-482910'

    usuario = relationship("Usuario", back_populates="transacciones")

class BancoRed(Base):
    """Tabla de Bancos de la Red y Límites Coordinados (Protocolo Interbancario TCP 5000 / UDP 5005)."""
    __tablename__ = "bancos_red"

    id_banco = Column(Integer, primary_key=True, autoincrement=True)
    codigo_banco = Column(String(15), unique=True, nullable=False)  # 'BANC01', 'BANC02', etc.
    nombre_banco = Column(String(100), nullable=False)
    ip = Column(String(50), default="127.0.0.1", nullable=False)
    puerto = Column(Integer, default=5000, nullable=False)
    es_propio = Column(Boolean, default=False, nullable=False)      # 1 = Nuestro banco, 0 = Otro banco
    limite_diario = Column(Numeric(12, 2), default=25000.00, nullable=False)
    transferido_hoy = Column(Numeric(12, 2), default=0.00, nullable=False)
    fecha_ultimo_reinicio = Column(DateTime, default=utc_now, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)

class TransferenciaBancaria(Base):
    """Registro de Transferencias Interbancarias con Tokens Compartidos (Guardado por ambos bancos y usuario)."""
    __tablename__ = "transferencias_bancarias"

    id_transferencia = Column(Integer, primary_key=True, autoincrement=True)
    token_transferencia = Column(String(40), nullable=False, index=True)  # Ej: 'TRF-20261029-482910'
    tipo_transferencia = Column(String(20), default="INTERBANCARIA", nullable=False)  # INTERNA | INTERBANCARIA
    banco_origen = Column(String(15), nullable=False)
    cuenta_origen = Column(String(20), nullable=False)
    nombre_origen = Column(String(100), nullable=False)
    banco_destino = Column(String(15), nullable=False)
    cuenta_destino = Column(String(20), nullable=False)
    nombre_destino = Column(String(100), nullable=False)
    monto = Column(Numeric(12, 2), nullable=False)
    concepto = Column(String(200), nullable=True)
    cupo_restante_banco_origen = Column(Numeric(12, 2), nullable=True)
    cupo_restante_banco_destino = Column(Numeric(12, 2), nullable=True)
    estado = Column(String(20), default="APROBADA", nullable=False)
    fecha_creacion = Column(DateTime, default=utc_now, nullable=False)

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
    tabla_origen = Column(String(50), nullable=False)  # usuarios | tarjetas | transacciones | cajeros
    id_registro_origen = Column(String(50), nullable=False)  # ej. 'ATM-005' o id de usuario
    datos_eliminados_json = Column(JSON, nullable=False)
    motivo = Column(String(255), nullable=True)
    eliminado_por_id = Column(Integer, nullable=True)
    eliminado_por_nombre = Column(String(100), nullable=True)
    id_usuario_afectado = Column(Integer, nullable=True)
    visible_para_usuario = Column(Boolean, default=True, nullable=False)
    fecha_eliminacion = Column(DateTime, default=utc_now, nullable=False)
