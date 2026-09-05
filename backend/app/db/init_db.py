from datetime import datetime
from backend.app.db.database import Base, engine, SessionLocal
from backend.app.db.models import Role, Usuario, Tarjeta, DenominacionCajero, LogAuditoria
from backend.app.core.security import get_pin_hash

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Role).count() == 0:
            admin_role = Role(id_rol=1, nombre_rol="ADMINISTRADOR")
            user_role = Role(id_rol=2, nombre_rol="USUARIO")
            db.add_all([admin_role, user_role])
            db.commit()
            print("[INIT_DB] Roles sembrados.")

        if db.query(DenominacionCajero).count() == 0:
            init_denoms = [
                DenominacionCajero(denominacion=200, cantidad_billetes=20), # 4000
                DenominacionCajero(denominacion=100, cantidad_billetes=30), # 3000
                DenominacionCajero(denominacion=50, cantidad_billetes=20),  # 1000
                DenominacionCajero(denominacion=20, cantidad_billetes=50),  # 1000
                DenominacionCajero(denominacion=10, cantidad_billetes=50),  # 500
                DenominacionCajero(denominacion=5, cantidad_billetes=50),   # 250
                DenominacionCajero(denominacion=1, cantidad_billetes=100),  # 100
            ]
            db.add_all(init_denoms)
            db.commit()
            print("[INIT_DB] Denominaciones iniciales de bóveda sembradas (Total Q9,850.00).")

        if db.query(Usuario).count() == 0:
            hashed_pin = get_pin_hash("1234")
            admin_user = Usuario(
                id_usuario=1,
                id_rol=1,
                nombre_completo="Administrador Bóveda",
                pin_hash=hashed_pin,
                token_temporal="123456",
                saldo_actual=10000.00,
                monto_max_diario=50000.00,
                total_retirado_hoy=0.00,
                fecha_ultimo_acceso=datetime.utcnow(),
                activo=True
            )
            admin_card = Tarjeta(id_usuario=1, numero_tarjeta="9999888877776666", activa=True)

            employees = [
                ("Carlos Gómez (Empleado 1)", "1234567812345678", "456789", 3500.00, 2000.00),
                ("María López (Empleado 2)", "2345678923456789", "654321", 4800.00, 2500.00),
                ("Juan Pérez (Empleado 3)", "3456789034567890", "112233", 1500.00, 1500.00),
                ("Ana Morales (Empleado 4)", "4567890145678901", "334455", 6200.00, 3000.00),
                ("Roberto Castillo (Empleado 5)", "5678901256789012", "998877", 2100.00, 2000.00),
            ]

            db.add(admin_user)
            db.add(admin_card)
            db.flush()

            for i, (name, card_num, tok, sal, limit) in enumerate(employees, start=2):
                usr = Usuario(
                    id_usuario=i,
                    id_rol=2,
                    nombre_completo=name,
                    pin_hash=hashed_pin,
                    token_temporal=tok,
                    saldo_actual=sal,
                    monto_max_diario=limit,
                    total_retirado_hoy=0.00,
                    fecha_ultimo_acceso=datetime.utcnow(),
                    activo=True
                )
                crd = Tarjeta(id_usuario=i, numero_tarjeta=card_num, activa=True)
                db.add(usr)
                db.add(crd)

            log = LogAuditoria(
                id_usuario=1,
                accion="INICIALIZACION_SISTEMA",
                detalles="Sistema inicializado con 5 trabajadores corporativos y 1 administrador.",
                fecha_hora=datetime.utcnow()
            )
            db.add(log)
            db.commit()
            print("[INIT_DB] Usuarios corporativos y tarjetas sembrados.")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()