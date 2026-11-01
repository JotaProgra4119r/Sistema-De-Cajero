import sys
import os
import random
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from datetime import datetime, timezone
import hashlib
from sqlalchemy import text
from database.connection import engine, SessionLocal, Base
from database.models import (
    Role, Usuario, Tarjeta, Cajero, DenominacionCajero, ArqueoCajero, LogAuditoria, RegistroEliminado,
    BancoRed, TransferenciaBancaria
)

def get_pin_hash(pin: str) -> str:
    salt = os.getenv("ATM_SALT", "ATM_SALT_2026")
    return hashlib.sha256(f"{salt}:{pin}".encode("utf-8")).hexdigest()

def migrate_existing_schema(db):
    """Aplica migraciones automáticas sobre tablas existentes en SQLite o MySQL."""
    alter_queries = [
        "ALTER TABLE usuarios ADD COLUMN id_cuenta_bancaria VARCHAR(20)",
        "ALTER TABLE denominaciones_cajero ADD COLUMN id_cajero VARCHAR(20) DEFAULT 'ATM-001'",
        "ALTER TABLE arqueos_cajero ADD COLUMN id_cajero VARCHAR(20) DEFAULT 'ATM-001'",
        "ALTER TABLE transacciones ADD COLUMN id_cajero VARCHAR(20) DEFAULT 'ATM-001'",
        "ALTER TABLE transacciones ADD COLUMN id_cuenta_destino VARCHAR(20)",
        "ALTER TABLE transacciones ADD COLUMN nombre_destinatario VARCHAR(100)",
        "ALTER TABLE transacciones ADD COLUMN token_transferencia VARCHAR(40)",
        "ALTER TABLE cajeros ADD COLUMN codigo_cajero VARCHAR(10) DEFAULT '1234'",
        "ALTER TABLE cajeros ADD COLUMN en_linea BOOLEAN DEFAULT 0",
        "ALTER TABLE cajeros ADD COLUMN sesion_activa_id VARCHAR(100)",
        "ALTER TABLE cajeros ADD COLUMN ultimo_latido DATETIME",
    ]
    for q in alter_queries:
        try:
            db.execute(text(q))
            db.commit()
        except Exception:
            db.rollback()

    # SQLite migration if legacy table had unique constraint on denominacion alone
    try:
        if "sqlite" in engine.url.drivername:
            create_sql = db.execute(text("SELECT sql FROM sqlite_master WHERE name='denominaciones_cajero'")).scalar()
            if create_sql and "UNIQUE (denominacion)" in create_sql:
                db.execute(text("""
                    CREATE TABLE IF NOT EXISTS denominaciones_cajero_new (
                        id_denominacion INTEGER PRIMARY KEY AUTOINCREMENT,
                        id_cajero VARCHAR(20) NOT NULL DEFAULT 'ATM-001',
                        denominacion INTEGER NOT NULL,
                        cantidad_billetes INTEGER NOT NULL DEFAULT 0,
                        UNIQUE(id_cajero, denominacion)
                    );
                """))
                db.execute(text("""
                    INSERT OR IGNORE INTO denominaciones_cajero_new (id_denominacion, id_cajero, denominacion, cantidad_billetes)
                    SELECT id_denominacion, COALESCE(id_cajero, 'ATM-001'), denominacion, cantidad_billetes FROM denominaciones_cajero;
                """))
                db.execute(text("DROP TABLE denominaciones_cajero;"))
                db.execute(text("ALTER TABLE denominaciones_cajero_new RENAME TO denominaciones_cajero;"))
                db.commit()
    except Exception:
        db.rollback()

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Migración de esquema en caliente para compatibilidad
        migrate_existing_schema(db)

        # 1. Seed Roles
        role_admin = db.query(Role).filter(Role.nombre_rol == "ADMINISTRADOR").first()
        if not role_admin:
            role_admin = Role(id_rol=1, nombre_rol="ADMINISTRADOR")
            db.add(role_admin)
        
        role_user = db.query(Role).filter(Role.nombre_rol == "USUARIO").first()
        if not role_user:
            role_user = Role(id_rol=2, nombre_rol="USUARIO")
            db.add(role_user)

        role_super = db.query(Role).filter(Role.nombre_rol == "SUPERADMIN").first()
        if not role_super:
            role_super = Role(id_rol=3, nombre_rol="SUPERADMIN")
            db.add(role_super)
        db.commit()

        # 2. Seed Red Multicajero (Cajeros Independientes)
        atms_seed = [
            ("ATM-001", "Cajero Central - Sede Principal (Zona 10)", "7ma Avenida 12-34, Zona 10, Ciudad de Guatemala"),
            ("ATM-002", "Cajero Express - Sucursal Zona 1", "6ta Avenida 4-20, Centro Histórico, Zona 1"),
            ("ATM-003", "Cajero Miraflores - Centro Comercial", "Calzada Roosevelt, C.C. Miraflores, Local K-12"),
        ]
        for atm_id, name, location in atms_seed:
            existing_atm = db.query(Cajero).filter(Cajero.id_cajero == atm_id).first()
            if not existing_atm:
                db.add(Cajero(
                    id_cajero=atm_id,
                    nombre=name,
                    ubicacion=location,
                    estado="ACTIVO",
                    is_initialized=False,
                    codigo_cajero="1234",
                    en_linea=False
                ))
            else:
                if not existing_atm.codigo_cajero:
                    existing_atm.codigo_cajero = "1234"
        db.commit()

        # 3. Seed Local Admin User
        admin_user = db.query(Usuario).filter(Usuario.id_rol == 1).first()
        if not admin_user:
            admin_user = Usuario(
                id_rol=1,
                nombre_completo="Administrador Bóveda",
                id_cuenta_bancaria="99999999",
                pin_hash=get_pin_hash("1234"),
                token_temporal="123456",
                saldo_actual=0.00,
                monto_max_diario=999999.00,
                total_retirado_hoy=0.00,
                fecha_ultimo_acceso=datetime.now(timezone.utc),
                activo=True
            )
            db.add(admin_user)
            db.flush()

            card_admin = Tarjeta(
                id_usuario=admin_user.id_usuario,
                numero_tarjeta="9999888877776666",
                activa=True
            )
            db.add(card_admin)
            db.commit()
        else:
            if not admin_user.id_cuenta_bancaria:
                admin_user.id_cuenta_bancaria = "99999999"
                db.commit()

        # 4. Seed 5 Corporate Employees con Tokens/IDs de Cuenta de 8 dígitos
        employees_seed = [
            ("Carlos Roberto Gómez", "1234567812345678", 3500.00, 2000.00, "10014528"),
            ("María Andrea López",   "2345678923456789", 4800.00, 2500.00, "20027819"),
            ("Juan Fernando Pérez",  "3456789034567890", 1500.00, 1500.00, "30039142"),
            ("Sofía Isabel Morales", "4567890145678901", 6200.00, 3000.00, "40041285"),
            ("Diego Alejandro Ruiz", "5678901256789012", 2100.00, 2000.00, "50056391"),
        ]

        for name, card_num, balance, limit, acct_id in employees_seed:
            existing_card = db.query(Tarjeta).filter(Tarjeta.numero_tarjeta == card_num).first()
            if not existing_card:
                u = Usuario(
                    id_rol=2,
                    nombre_completo=name,
                    id_cuenta_bancaria=acct_id,
                    pin_hash=get_pin_hash("1234"),
                    token_temporal="456789",
                    saldo_actual=balance,
                    monto_max_diario=limit,
                    total_retirado_hoy=0.00,
                    fecha_ultimo_acceso=datetime.now(timezone.utc),
                    activo=True
                )
                db.add(u)
                db.flush()

                c = Tarjeta(
                    id_usuario=u.id_usuario,
                    numero_tarjeta=card_num,
                    activa=True
                )
                db.add(c)
            else:
                # Ensure existing user has the 8-digit ID
                u = existing_card.usuario
                if u and not u.id_cuenta_bancaria:
                    u.id_cuenta_bancaria = acct_id
        db.commit()

        # 5. Seed Super Admin User (Cuenta de prueba rápida aislada)
        super_user = db.query(Usuario).filter(Usuario.id_rol == 3).first()
        if not super_user:
            super_user = Usuario(
                id_rol=3,
                nombre_completo="Super Administrador Global",
                id_cuenta_bancaria="88888888",
                pin_hash=get_pin_hash("1234"),
                token_temporal="888999",
                saldo_actual=0.00,
                monto_max_diario=9999999.00,
                total_retirado_hoy=0.00,
                fecha_ultimo_acceso=datetime.now(timezone.utc),
                activo=True
            )
            db.add(super_user)
            db.flush()

            card_super = db.query(Tarjeta).filter(Tarjeta.numero_tarjeta == "8888888888888888").first()
            if not card_super:
                card_super = Tarjeta(
                    id_usuario=super_user.id_usuario,
                    numero_tarjeta="8888888888888888",
                    activa=True
                )
                db.add(card_super)
            db.commit()
            print("[DATABASE] Super Administrador creado con credenciales (Tarjeta: 8888888888888888, PIN: 1234, ID: 88888888).")

        # Asignar ID de 8 dígitos a cualquier usuario restante que no lo tenga
        other_users = db.query(Usuario).filter(Usuario.id_cuenta_bancaria == None).all()
        for ou in other_users:
            ou.id_cuenta_bancaria = str(70000000 + ou.id_usuario)
        if other_users:
            db.commit()

        # 6. Seed Denominaciones por Cajero (Inventario Físico Independiente)
        denominaciones_list = [200, 100, 50, 20, 10, 5, 1]
        all_cajeros = db.query(Cajero).all()
        for cajero in all_cajeros:
            for denom in denominaciones_list:
                rec = db.query(DenominacionCajero).filter(
                    DenominacionCajero.id_cajero == cajero.id_cajero,
                    DenominacionCajero.denominacion == denom
                ).first()
                if not rec:
                    db.add(DenominacionCajero(
                        id_cajero=cajero.id_cajero,
                        denominacion=denom,
                        cantidad_billetes=0
                    ))
        db.commit()

        # 7. Crear o actualizar Vistas SQL 'retiros' y 'depositos' para SQL Server / Workbench
        is_sqlite = "sqlite" in engine.url.drivername
        view_prefix = "CREATE VIEW IF NOT EXISTS" if is_sqlite else "CREATE OR REPLACE VIEW"
        try:
            db.execute(text(f"""
                {view_prefix} retiros AS
                SELECT 
                    t.id_transaccion,
                    t.id_cajero,
                    t.id_usuario,
                    u.nombre_completo AS cliente,
                    t.monto,
                    t.fecha_hora,
                    t.desglose_billetes
                FROM transacciones t
                JOIN usuarios u ON t.id_usuario = u.id_usuario
                WHERE t.tipo_transaccion = 'RETIRO'
            """))
            db.execute(text(f"""
                {view_prefix} depositos AS
                SELECT 
                    t.id_transaccion,
                    t.id_cajero,
                    t.id_usuario,
                    u.nombre_completo AS cliente,
                    t.monto,
                    t.tipo_transaccion,
                    t.id_cuenta_destino,
                    t.nombre_destinatario,
                    t.fecha_hora,
                    t.desglose_billetes
                FROM transacciones t
                JOIN usuarios u ON t.id_usuario = u.id_usuario
                WHERE t.tipo_transaccion IN ('DEPOSITO', 'DEPOSITO_A_TERCERO')
            """))
            db.commit()
            print("[DATABASE] Vistas SQL 'retiros' y 'depositos' registradas exitosamente.")
        except Exception as v_err:
            print(f"[DATABASE] Nota sobre creación de vistas: {v_err}")

        # 8. Seed Red Interbancaria (Protocolo TCP 5000 / UDP 5005)
        bancos_seed = [
            ("BANC02", "Banco Nacional Inzano GYT", "127.0.0.1", 5000, True, 25000.00),
            ("NETGEAR", "NETGEAR Interbank", "127.0.0.1", 5000, False, 25000.00),
            ("BANC01", "NEXUSBANK", "10.219.19.9", 5000, False, 25000.00),
        ]
        for cod, nom, ip, port, propio, lim in bancos_seed:
            banco = db.query(BancoRed).filter(BancoRed.codigo_banco == cod).first()
            if not banco:
                db.add(BancoRed(
                    codigo_banco=cod,
                    nombre_banco=nom,
                    ip=ip,
                    puerto=port,
                    es_propio=propio,
                    limite_diario=lim,
                    transferido_hoy=0.00,
                    fecha_ultimo_reinicio=datetime.now(timezone.utc),
                    activo=True
                ))
            else:
                banco.nombre_banco = nom
                banco.puerto = port
                banco.limite_diario = lim
                if propio:
                    banco.es_propio = True
        db.commit()
        print("[DATABASE] Red Interbancaria (BANC02, NETGEAR y BANC01) sincronizada.")

        print("[DATABASE] Base de datos relacional y red de cajeros inicializada correctamente.")
    except Exception as e:
        db.rollback()
        print(f"[DATABASE ERROR] Error inicializando base de datos: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
