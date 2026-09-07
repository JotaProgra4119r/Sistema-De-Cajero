import sys
import os
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from datetime import datetime, timezone
import hashlib
from database.connection import engine, SessionLocal, Base
from database.models import (
    Role, Usuario, Tarjeta, DenominacionCajero, ArqueoCajero, LogAuditoria, RegistroEliminado
)

def get_pin_hash(pin: str) -> str:
    salt = os.getenv("ATM_SALT", "ATM_SALT_2026")
    return hashlib.sha256(f"{salt}:{pin}".encode("utf-8")).hexdigest()

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Seed Roles
        role_admin = db.query(Role).filter(Role.nombre_rol == "ADMINISTRADOR").first()
        if not role_admin:
            role_admin = Role(id_rol=1, nombre_rol="ADMINISTRADOR")
            db.add(role_admin)
        
        role_user = db.query(Role).filter(Role.nombre_rol == "USUARIO").first()
        if not role_user:
            role_user = Role(id_rol=2, nombre_rol="USUARIO")
            db.add(role_user)
        db.commit()

        # 2. Seed Admin User
        admin_user = db.query(Usuario).filter(Usuario.id_rol == 1).first()
        if not admin_user:
            admin_user = Usuario(
                id_rol=1,
                nombre_completo="Administrador Bóveda",
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

        # 3. Seed 5 Corporate Employees
        employees_seed = [
            ("Carlos Roberto Gómez", "1234567812345678", 3500.00, 2000.00),
            ("María Andrea López",   "2345678923456789", 4800.00, 2500.00),
            ("Juan Fernando Pérez",  "3456789034567890", 1500.00, 1500.00),
            ("Sofía Isabel Morales", "4567890145678901", 6200.00, 3000.00),
            ("Diego Alejandro Ruiz", "5678901256789012", 2100.00, 2000.00),
        ]

        for name, card_num, balance, limit in employees_seed:
            existing_card = db.query(Tarjeta).filter(Tarjeta.numero_tarjeta == card_num).first()
            if not existing_card:
                u = Usuario(
                    id_rol=2,
                    nombre_completo=name,
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
        db.commit()

        # 4. Seed Vault Initial Inventory (Total: Q9,850.00)
        vault_seed = {
            200: 20, # Q4,000
            100: 30, # Q3,000
            50:  30, # Q1,500
            20:  40, # Q800
            10:  35, # Q350
            5:   30, # Q150
            1:   50  # Q50
        }
        has_denoms = db.query(DenominacionCajero).first()
        if not has_denoms:
            total_vault = 0
            for d, qty in vault_seed.items():
                db.add(DenominacionCajero(denominacion=d, cantidad_billetes=qty))
                total_vault += d * qty
            
            db.add(ArqueoCajero(
                tipo_evento="INICIALIZACION",
                monto_total=total_vault,
                fecha_evento=datetime.now(timezone.utc)
            ))
            db.commit()
            print(f"[DATABASE] Bóveda semillada con Q{total_vault:.2f} en 7 denominaciones.")

        print("[DATABASE] Base de datos relacional inicializada correctamente.")
    except Exception as e:
        db.rollback()
        print(f"[DATABASE ERROR] Error inicializando base de datos: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
