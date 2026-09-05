import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.db.models import (
    Usuario, Tarjeta, Role, DenominacionCajero, ArqueoCajero, Transaccion, LogAuditoria
)
from backend.app.core.security import (
    verify_pin, get_pin_hash, verify_totp_token, create_access_token
)
from backend.app.storage_txt.txt_manager import txt_manager
from backend.app.hardware.serial_controller import serial_controller
from backend.app.hardware.esp32_controller import esp32_controller

VALID_DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1]
MAX_VAULT_INIT = 10000.00
MAX_VAULT_CAPACITY = 30000.00

class BankingService:
    @staticmethod
    def authenticate(db: Session, card_number: str, pin: str, token: str, is_admin_mode: bool) -> Dict[str, Any]:
        clean_card = card_number.replace("-", "").strip()
        if len(clean_card) != 16 or not clean_card.isdigit():
            raise HTTPException(status_code=400, detail="El número de tarjeta debe tener exactamente 16 dígitos numéricos.")
        
        card = db.query(Tarjeta).filter(Tarjeta.numero_tarjeta == clean_card, Tarjeta.activa == True).first()
        if not card:
            raise HTTPException(status_code=401, detail="Tarjeta no encontrada o inactiva.")
        
        user = card.usuario
        if not user or not user.activo:
            raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo.")
        
        if is_admin_mode and user.rol.nombre_rol != "ADMINISTRADOR":
            raise HTTPException(status_code=403, detail="Acceso denegado: Se requieren credenciales de Administrador.")
        
        if not is_admin_mode and user.rol.nombre_rol == "ADMINISTRADOR":
            # Admin can also log in to user mode or view
            pass

        if not verify_pin(pin, user.pin_hash):
            raise HTTPException(status_code=401, detail="PIN de seguridad incorrecto.")
        
        # Verify dynamic TOTP token
        if not verify_totp_token(token):
            raise HTTPException(status_code=401, detail="Token dinámico de seguridad inválido o expirado.")
        
        # Update last access
        user.fecha_ultimo_acceso = datetime.now()
        db.commit()

        # Generate JWT
        access_token = create_access_token({
            "sub": str(user.id_usuario),
            "role": user.rol.nombre_rol,
            "card": clean_card,
            "name": user.nombre_completo
        })

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id_usuario": user.id_usuario,
                "nombre_completo": user.nombre_completo,
                "rol": user.rol.nombre_rol,
                "tarjeta": clean_card,
                "saldo_actual": float(user.saldo_actual),
                "monto_max_diario": float(user.monto_max_diario),
                "total_retirado_hoy": float(user.total_retirado_hoy),
                "cupo_disponible": max(0.0, float(user.monto_max_diario) - float(user.total_retirado_hoy)),
                "cambio_pin_realizado": user.cambio_pin_realizado
            }
        }

    @staticmethod
    def get_user_summary(db: Session, user_id: int) -> Dict[str, Any]:
        user = db.query(Usuario).filter(Usuario.id_usuario == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")
        active_card = next((c.numero_tarjeta for c in user.tarjetas if c.activa), "N/A")
        
        # Fetch vault stock for user denomination selection
        vault_denoms = db.query(DenominacionCajero).all()
        stock_map = {d.denominacion: d.cantidad_billetes for d in vault_denoms}
        
        return {
            "id_usuario": user.id_usuario,
            "nombre_completo": user.nombre_completo,
            "tarjeta": active_card,
            "saldo_actual": float(user.saldo_actual),
            "monto_max_diario": float(user.monto_max_diario),
            "total_retirado_hoy": float(user.total_retirado_hoy),
            "cupo_disponible": max(0.0, float(user.monto_max_diario) - float(user.total_retirado_hoy)),
            "cambio_pin_realizado": user.cambio_pin_realizado,
            "stock_boveda": stock_map
        }

    @staticmethod
    async def withdraw_custom(db: Session, user_id: int, amount: float, bills: Dict[str, int]) -> Dict[str, Any]:
        if amount <= 0:
            raise HTTPException(status_code=400, detail="El monto de retiro debe ser mayor a cero.")
        
        user = db.query(Usuario).filter(Usuario.id_usuario == user_id).with_for_update().first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")
        
        # 1. Verificación de balance
        if float(user.saldo_actual) < amount:
            raise HTTPException(
                status_code=400,
                detail=f"Saldo insuficiente. Su saldo contable es de Q{float(user.saldo_actual):.2f}."
            )
        
        # 2. Verificación de cupo diario
        if float(user.total_retirado_hoy) + amount > float(user.monto_max_diario):
            cupo = max(0.0, float(user.monto_max_diario) - float(user.total_retirado_hoy))
            raise HTTPException(
                status_code=400,
                detail=f"Límite diario superado. Su cupo disponible hoy es de Q{cupo:.2f}."
            )
        
        # 3. Consistencia aritmética: suma de billetes seleccionados == monto
        clean_bills = {}
        sum_selected = 0
        for denom_str, count in bills.items():
            d = int(denom_str)
            c = int(count)
            if d not in VALID_DENOMINATIONS:
                raise HTTPException(status_code=400, detail=f"Denominación Q{d} no válida en Quetzales.")
            if c < 0:
                raise HTTPException(status_code=400, detail="La cantidad de billetes no puede ser negativa.")
            if c > 0:
                clean_bills[str(d)] = c
                sum_selected += d * c
        
        if sum_selected != int(amount):
            raise HTTPException(
                status_code=400,
                detail=f"Consistencia aritmética inválida: La suma de billetes seleccionados (Q{sum_selected}) no coincide con el monto solicitado (Q{amount:.2f})."
            )
        
        # 4. Verificación de existencias físicas en la bóveda
        vault_records = {d.denominacion: d for d in db.query(DenominacionCajero).all()}
        for denom_str, count in clean_bills.items():
            d = int(denom_str)
            rec = vault_records.get(d)
            if not rec or rec.cantidad_billetes < count:
                disp = rec.cantidad_billetes if rec else 0
                raise HTTPException(
                    status_code=400,
                    detail=f"Inventario físico insuficiente en bóveda para billetes de Q{d}. Disponibles: {disp}, solicitados: {count}."
                )
        
        # 5. Coordinación física de despacho con microcontrolador Arduino Mega 2560
        dispense_res = await serial_controller.dispense(clean_bills)
        if dispense_res.get("status") != "SUCCESS":
            err_code = dispense_res.get("code", "ERROR_DESCONOCIDO")
            # Log failure in audit
            log_err = LogAuditoria(
                id_usuario=user.id_usuario,
                accion="FALLO_DISPENSACION_FISICA",
                detalles=f"Error en hardware: {err_code}. Monto solicitado Q{amount:.2f}. No se aplicaron débitos contables.",
                fecha_hora=datetime.now()
            )
            db.add(log_err)
            db.commit()
            await txt_manager.append_auditoria(log_err.id_log, user.id_usuario, log_err.accion, log_err.detalles)
            raise HTTPException(
                status_code=500,
                detail=f"Fallo mecánico en actuadores del cajero ({err_code}). Operación cancelada; no se debitó su cuenta."
            )

        # 6. Débito contable atómico en BD
        user.saldo_actual = float(user.saldo_actual) - amount
        user.total_retirado_hoy = float(user.total_retirado_hoy) + amount

        # Decrement vault inventory
        for denom_str, count in clean_bills.items():
            d = int(denom_str)
            vault_records[d].cantidad_billetes -= count

        # Register transaction
        now = datetime.now()
        tx = Transaccion(
            id_usuario=user.id_usuario,
            tipo_transaccion="RETIRO",
            monto=amount,
            fecha_hora=now,
            desglose_billetes=clean_bills
        )
        db.add(tx)

        # Capture security snapshot
        photo_name = await esp32_controller.capture_transaction_photo(user.id_usuario)

        # Audit log
        log = LogAuditoria(
            id_usuario=user.id_usuario,
            accion="RETIRO_EFECTIVO",
            detalles=f"Retiro exitoso de Q{amount:.2f} con desglose {clean_bills}. Foto: {photo_name}",
            fecha_hora=now
        )
        db.add(log)
        db.commit()
        db.refresh(tx)
        db.refresh(log)

        # 7. Persistencia Dual Concurrente en archivos planos (.txt)
        active_card = next((c.numero_tarjeta for c in user.tarjetas if c.activa), "N/A")
        await txt_manager.update_usuario(
            user.id_usuario, user.nombre_completo, active_card, user.pin_hash,
            float(user.saldo_actual), float(user.monto_max_diario), float(user.total_retirado_hoy),
            user.cambio_pin_realizado, user.fecha_ultimo_acceso
        )
        inv_dict = {d.denominacion: d.cantidad_billetes for d in vault_records.values()}
        await txt_manager.update_inventario(inv_dict)
        await txt_manager.append_transaccion(tx.id_transaccion, user.id_usuario, "RETIRO", amount, clean_bills, now)
        await txt_manager.append_auditoria(log.id_log, user.id_usuario, log.accion, log.detalles, now)

        return {
            "status": "SUCCESS",
            "mensaje": f"Retiro de Q{amount:.2f} completado con éxito.",
            "id_transaccion": tx.id_transaccion,
            "monto": amount,
            "desglose": clean_bills,
            "nuevo_saldo": float(user.saldo_actual),
            "cupo_disponible": max(0.0, float(user.monto_max_diario) - float(user.total_retirado_hoy)),
            "fecha_hora": now.strftime("%Y-%m-%d %H:%M:%S")
        }

    @staticmethod
    async def deposit_custom(db: Session, user_id: int, bills: Dict[str, int]) -> Dict[str, Any]:
        user = db.query(Usuario).filter(Usuario.id_usuario == user_id).with_for_update().first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")

        clean_bills = {}
        total_deposit = 0
        for denom_str, count in bills.items():
            d = int(denom_str)
            c = int(count)
            if d not in VALID_DENOMINATIONS:
                raise HTTPException(status_code=400, detail=f"Denominación Q{d} no válida.")
            if c < 0:
                raise HTTPException(status_code=400, detail="La cantidad de piezas no puede ser negativa.")
            if c > 0:
                clean_bills[str(d)] = c
                total_deposit += d * c

        if total_deposit <= 0:
            raise HTTPException(status_code=400, detail="Debe ingresar al menos un billete para realizar el depósito.")

        vault_records = {d.denominacion: d for d in db.query(DenominacionCajero).all()}
        current_vault_total = sum(d.denominacion * d.cantidad_billetes for d in vault_records.values())
        if current_vault_total + total_deposit > MAX_VAULT_CAPACITY:
            raise HTTPException(
                status_code=400,
                detail=f"La bóveda superaría la capacidad máxima permitida de Q{MAX_VAULT_CAPACITY:.2f}. Capacidad disponible: Q{MAX_VAULT_CAPACITY - current_vault_total:.2f}."
            )

        # Apply credit
        user.saldo_actual = float(user.saldo_actual) + total_deposit
        for denom_str, count in clean_bills.items():
            d = int(denom_str)
            vault_records[d].cantidad_billetes += count

        now = datetime.now()
        tx = Transaccion(
            id_usuario=user.id_usuario,
            tipo_transaccion="DEPOSITO",
            monto=total_deposit,
            fecha_hora=now,
            desglose_billetes=clean_bills
        )
        db.add(tx)

        log = LogAuditoria(
            id_usuario=user.id_usuario,
            accion="DEPOSITO_EFECTIVO",
            detalles=f"Depósito exitoso de Q{total_deposit:.2f} desglosado: {clean_bills}.",
            fecha_hora=now
        )
        db.add(log)
        db.commit()
        db.refresh(tx)
        db.refresh(log)

        # Dual write to .txt
        active_card = next((c.numero_tarjeta for c in user.tarjetas if c.activa), "N/A")
        await txt_manager.update_usuario(
            user.id_usuario, user.nombre_completo, active_card, user.pin_hash,
            float(user.saldo_actual), float(user.monto_max_diario), float(user.total_retirado_hoy),
            user.cambio_pin_realizado, user.fecha_ultimo_acceso
        )
        inv_dict = {d.denominacion: d.cantidad_billetes for d in vault_records.values()}
        await txt_manager.update_inventario(inv_dict)
        await txt_manager.append_transaccion(tx.id_transaccion, user.id_usuario, "DEPOSITO", total_deposit, clean_bills, now)
        await txt_manager.append_auditoria(log.id_log, user.id_usuario, log.accion, log.detalles, now)

        return {
            "status": "SUCCESS",
            "mensaje": f"Depósito de Q{total_deposit:.2f} realizado con éxito.",
            "id_transaccion": tx.id_transaccion,
            "monto": total_deposit,
            "desglose": clean_bills,
            "nuevo_saldo": float(user.saldo_actual),
            "fecha_hora": now.strftime("%Y-%m-%d %H:%M:%S")
        }

    @staticmethod
    async def change_pin(db: Session, user_id: int, card_number: str, current_pin: str, token: str, new_pin: str) -> Dict[str, Any]:
        if len(new_pin) != 4 or not new_pin.isdigit():
            raise HTTPException(status_code=400, detail="El nuevo PIN debe contener exactamente 4 dígitos numéricos.")
        
        user = db.query(Usuario).filter(Usuario.id_usuario == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")
        
        clean_card = card_number.replace("-", "").strip()
        has_card = any(c.numero_tarjeta == clean_card and c.activa for c in user.tarjetas)
        if not has_card:
            raise HTTPException(status_code=400, detail="El número de tarjeta no coincide con la cuenta activa.")
        
        if not verify_pin(current_pin, user.pin_hash):
            raise HTTPException(status_code=401, detail="El PIN actual ingresado es incorrecto.")
        
        if not verify_totp_token(token):
            raise HTTPException(status_code=401, detail="Token dinámico de seguridad inválido.")
        
        user.pin_hash = get_pin_hash(new_pin)
        user.cambio_pin_realizado = True
        
        log = LogAuditoria(
            id_usuario=user.id_usuario,
            accion="ACTUALIZACION_PIN",
            detalles="El usuario realizó cambio de PIN confidencial satisfactoriamente.",
            fecha_hora=datetime.now()
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        # Dual write
        await txt_manager.update_usuario(
            user.id_usuario, user.nombre_completo, clean_card, user.pin_hash,
            float(user.saldo_actual), float(user.monto_max_diario), float(user.total_retirado_hoy),
            user.cambio_pin_realizado, user.fecha_ultimo_acceso
        )
        await txt_manager.append_auditoria(log.id_log, user.id_usuario, log.accion, log.detalles)

        return {"status": "SUCCESS", "mensaje": "PIN confidencial actualizado correctamente."}

    # ==========================
    # SECCIÓN ADMINISTRATIVA
    # ==========================
    @staticmethod
    async def vault_initialize(db: Session, admin_user_id: int, bills: Dict[str, int]) -> Dict[str, Any]:
        total_init = sum(int(d) * int(c) for d, c in bills.items() if int(d) in VALID_DENOMINATIONS)
        if total_init > MAX_VAULT_INIT:
            raise HTTPException(
                status_code=400,
                detail=f"La inicialización no puede sobrepasar el límite estricto de Q{MAX_VAULT_INIT:.2f}. Total ingresado: Q{total_init:.2f}."
            )
        
        vault_records = {d.denominacion: d for d in db.query(DenominacionCajero).all()}
        for d in VALID_DENOMINATIONS:
            cnt = int(bills.get(str(d), bills.get(d, 0)))
            if cnt < 0:
                raise HTTPException(status_code=400, detail="La cantidad de piezas no puede ser negativa.")
            vault_records[d].cantidad_billetes = cnt

        # Reset daily withdrawn counters for all users upon daily initialization
        db.query(Usuario).update({Usuario.total_retirado_hoy: 0.00})

        # Register Arqueo
        arq = ArqueoCajero(
            tipo_evento="INICIALIZACION",
            monto_total=total_init,
            fecha_evento=datetime.now()
        )
        db.add(arq)

        log = LogAuditoria(
            id_usuario=admin_user_id,
            accion="INICIALIZACION_BOVEDA",
            detalles=f"Inicialización diaria completada con Q{total_init:.2f}. Consumos diarios reiniciados a cero.",
            fecha_hora=datetime.now()
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        # Dual write
        inv_dict = {d.denominacion: d.cantidad_billetes for d in vault_records.values()}
        await txt_manager.update_inventario(inv_dict)
        await txt_manager.append_auditoria(log.id_log, admin_user_id, log.accion, log.detalles)
        # Resync users txt
        await txt_manager.sync_all_from_db(db)

        return {
            "status": "SUCCESS",
            "mensaje": f"Bóveda inicializada con éxito por un total de Q{total_init:.2f}.",
            "total_boveda": total_init,
            "desglose": bills
        }

    @staticmethod
    async def vault_add_cash(db: Session, admin_user_id: int, bills: Dict[str, int]) -> Dict[str, Any]:
        # Must have been initialized previously
        last_init = db.query(ArqueoCajero).filter(ArqueoCajero.tipo_evento == "INICIALIZACION").first()
        if not last_init:
            raise HTTPException(status_code=400, detail="El cajero debe ser inicializado previamente antes de agregar efectivo.")

        vault_records = {d.denominacion: d for d in db.query(DenominacionCajero).all()}
        current_total = sum(d.denominacion * d.cantidad_billetes for d in vault_records.values())
        added_total = sum(int(d) * int(c) for d, c in bills.items() if int(d) in VALID_DENOMINATIONS)

        if current_total + added_total > MAX_VAULT_CAPACITY:
            raise HTTPException(
                status_code=400,
                detail=f"La operación superaría el límite consolidado de Q{MAX_VAULT_CAPACITY:.2f}. Saldo actual: Q{current_total:.2f}, intento de recarga: Q{added_total:.2f}."
            )

        for d in VALID_DENOMINATIONS:
            cnt = int(bills.get(str(d), bills.get(d, 0)))
            if cnt > 0:
                vault_records[d].cantidad_billetes += cnt

        new_total = current_total + added_total
        arq = ArqueoCajero(
            tipo_evento="RECARGA",
            monto_total=added_total,
            fecha_evento=datetime.now()
        )
        db.add(arq)

        log = LogAuditoria(
            id_usuario=admin_user_id,
            accion="RECARGA_BOVEDA",
            detalles=f"Recarga de efectivo por Q{added_total:.2f}. Nuevo saldo en bóveda: Q{new_total:.2f}.",
            fecha_hora=datetime.now()
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        # Dual write
        inv_dict = {d.denominacion: d.cantidad_billetes for d in vault_records.values()}
        await txt_manager.update_inventario(inv_dict)
        await txt_manager.append_auditoria(log.id_log, admin_user_id, log.accion, log.detalles)

        return {
            "status": "SUCCESS",
            "mensaje": f"Efectivo agregado exitosamente. Monto añadido: Q{added_total:.2f}.",
            "nuevo_saldo_boveda": new_total,
            "desglose_agregado": bills
        }

    @staticmethod
    async def admin_register_employee(db: Session, admin_user_id: int, name: str, card_number: str, pin: str, initial_balance: float, max_daily: float) -> Dict[str, Any]:
        clean_card = card_number.replace("-", "").strip()
        if len(clean_card) != 16 or not clean_card.isdigit():
            raise HTTPException(status_code=400, detail="El número de tarjeta debe tener 16 dígitos numéricos.")
        if len(pin) != 4 or not pin.isdigit():
            raise HTTPException(status_code=400, detail="El PIN debe tener 4 dígitos numéricos.")
        
        exists_card = db.query(Tarjeta).filter(Tarjeta.numero_tarjeta == clean_card).first()
        if exists_card:
            raise HTTPException(status_code=400, detail="El número de tarjeta ya se encuentra asignado en el sistema.")

        new_user = Usuario(
            id_rol=2, # USUARIO
            nombre_completo=name.strip(),
            pin_hash=get_pin_hash(pin),
            token_temporal="123456",
            saldo_actual=initial_balance,
            monto_max_diario=max_daily,
            total_retirado_hoy=0.00,
            fecha_ultimo_acceso=datetime.now(),
            activo=True
        )
        db.add(new_user)
        db.flush()

        card = Tarjeta(id_usuario=new_user.id_usuario, numero_tarjeta=clean_card, activa=True)
        db.add(card)

        log = LogAuditoria(
            id_usuario=admin_user_id,
            accion="ALTA_EMPLEADO",
            detalles=f"Registro de nuevo empleado {name} con tarjeta {clean_card}, saldo Q{initial_balance:.2f}, límite Q{max_daily:.2f}.",
            fecha_hora=datetime.now()
        )
        db.add(log)
        db.commit()
        db.refresh(new_user)
        db.refresh(log)

        await txt_manager.update_usuario(
            new_user.id_usuario, new_user.nombre_completo, clean_card, new_user.pin_hash,
            float(new_user.saldo_actual), float(new_user.monto_max_diario), float(new_user.total_retirado_hoy),
            new_user.cambio_pin_realizado, new_user.fecha_ultimo_acceso
        )
        await txt_manager.append_auditoria(log.id_log, admin_user_id, log.accion, log.detalles)

        return {"status": "SUCCESS", "mensaje": f"Empleado {name} registrado con éxito.", "id_usuario": new_user.id_usuario}

    @staticmethod
    async def admin_reassign_card(db: Session, admin_user_id: int, user_id: int, new_card_number: str) -> Dict[str, Any]:
        clean_card = new_card_number.replace("-", "").strip()
        if len(clean_card) != 16 or not clean_card.isdigit():
            raise HTTPException(status_code=400, detail="El nuevo número de tarjeta debe tener 16 dígitos numéricos.")

        exists_card = db.query(Tarjeta).filter(Tarjeta.numero_tarjeta == clean_card).first()
        if exists_card and exists_card.id_usuario != user_id:
            raise HTTPException(status_code=400, detail="El nuevo número de plástico ya pertenece a otra cuenta.")

        user = db.query(Usuario).filter(Usuario.id_usuario == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")

        # Deactivate previous cards
        for c in user.tarjetas:
            c.activa = False

        if exists_card and exists_card.id_usuario == user_id:
            exists_card.activa = True
        else:
            new_card = Tarjeta(id_usuario=user.id_usuario, numero_tarjeta=clean_card, activa=True)
            db.add(new_card)

        log = LogAuditoria(
            id_usuario=admin_user_id,
            accion="REASIGNACION_TARJETA",
            detalles=f"Reasignación de plástico a usuario {user.nombre_completo} (ID {user.id_usuario}). Nueva tarjeta: {clean_card}. Se preservan consumos de Q{float(user.total_retirado_hoy):.2f}.",
            fecha_hora=datetime.now()
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        await txt_manager.update_usuario(
            user.id_usuario, user.nombre_completo, clean_card, user.pin_hash,
            float(user.saldo_actual), float(user.monto_max_diario), float(user.total_retirado_hoy),
            user.cambio_pin_realizado, user.fecha_ultimo_acceso
        )
        await txt_manager.append_auditoria(log.id_log, admin_user_id, log.accion, log.detalles)

        return {"status": "SUCCESS", "mensaje": f"Tarjeta {clean_card} reasignada con éxito preservando historial acumulado."}

    @staticmethod
    async def admin_adjust_limit(db: Session, admin_user_id: int, user_id: int, new_limit: float) -> Dict[str, Any]:
        if new_limit <= 0:
            raise HTTPException(status_code=400, detail="El nuevo límite diario debe ser mayor a cero.")

        user = db.query(Usuario).filter(Usuario.id_usuario == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")

        prev_limit = float(user.monto_max_diario)
        user.monto_max_diario = new_limit

        log = LogAuditoria(
            id_usuario=admin_user_id,
            accion="AJUSTE_LIMITE_DIARIO",
            detalles=f"Ajuste de límite diario a usuario {user.nombre_completo}: de Q{prev_limit:.2f} a Q{new_limit:.2f}.",
            fecha_hora=datetime.now()
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        active_card = next((c.numero_tarjeta for c in user.tarjetas if c.activa), "N/A")
        await txt_manager.update_usuario(
            user.id_usuario, user.nombre_completo, active_card, user.pin_hash,
            float(user.saldo_actual), float(user.monto_max_diario), float(user.total_retirado_hoy),
            user.cambio_pin_realizado, user.fecha_ultimo_acceso
        )
        await txt_manager.append_auditoria(log.id_log, admin_user_id, log.accion, log.detalles)

        return {"status": "SUCCESS", "mensaje": f"Límite diario de {user.nombre_completo} ajustado a Q{new_limit:.2f}."}

    @staticmethod
    def get_admin_metrics(db: Session) -> Dict[str, Any]:
        vault_records = db.query(DenominacionCajero).order_by(DenominacionCajero.denominacion.desc()).all()
        total_vault = sum(d.denominacion * d.cantidad_billetes for d in vault_records)
        denoms_map = {d.denominacion: d.cantidad_billetes for d in vault_records}

        # KPI 1: Saldo en Bóveda (gauge to max Q30,000)
        vault_gauge = min(100.0, (total_vault / MAX_VAULT_CAPACITY) * 100.0)

        # KPI 2: Total retirado hoy por todos los usuarios
        total_retirado_hoy = db.query(func.sum(Usuario.total_retirado_hoy)).scalar() or 0.0

        # KPI 3: Promedio de depósitos
        avg_deposits = db.query(func.avg(Transaccion.monto)).filter(Transaccion.tipo_transaccion == "DEPOSITO").scalar() or 0.0

        # KPI 4: Estado de Inicialización
        has_init = db.query(ArqueoCajero).filter(ArqueoCajero.tipo_evento == "INICIALIZACION").first() is not None
        init_status = "Inicializado" if has_init else "Pendiente"

        # Users who changed PIN
        pin_changed_count = db.query(Usuario).filter(Usuario.cambio_pin_realizado == True).count()

        # Last logged user
        last_user = db.query(Usuario).order_by(Usuario.fecha_ultimo_acceso.desc().nullslast()).first()
        last_user_info = {
            "nombre": last_user.nombre_completo if last_user else "Ninguno",
            "timestamp": last_user.fecha_ultimo_acceso.strftime("%Y-%m-%d %H:%M:%S") if (last_user and last_user.fecha_ultimo_acceso) else "Sin accesos"
        }

        # Users table
        users = db.query(Usuario).all()
        users_table = []
        for u in users:
            active_card = next((c.numero_tarjeta for c in u.tarjetas if c.activa), "N/A")
            users_table.append({
                "id_usuario": u.id_usuario,
                "nombre_completo": u.nombre_completo,
                "tarjeta": active_card,
                "saldo_actual": float(u.saldo_actual),
                "monto_max_diario": float(u.monto_max_diario),
                "total_retirado_hoy": float(u.total_retirado_hoy),
                "ultimo_acceso": u.fecha_ultimo_acceso.strftime("%Y-%m-%d %H:%M:%S") if u.fecha_ultimo_acceso else "Nunca",
                "cambio_pin_realizado": u.cambio_pin_realizado,
                "rol": u.rol.nombre_rol
            })

        # Recent audit logs
        logs = db.query(LogAuditoria).order_by(LogAuditoria.fecha_hora.desc()).limit(15).all()
        audit_table = [{
            "id_log": l.id_log,
            "id_usuario": l.id_usuario,
            "accion": l.accion,
            "detalles": l.detalles,
            "fecha_hora": l.fecha_hora.strftime("%Y-%m-%d %H:%M:%S")
        } for l in logs]

        return {
            "saldo_boveda": total_vault,
            "capacidad_maxima_boveda": MAX_VAULT_CAPACITY,
            "porcentaje_boveda": vault_gauge,
            "total_retirado_hoy": float(total_retirado_hoy),
            "promedio_depositos": float(avg_deposits),
            "estado_inicializacion": init_status,
            "usuarios_cambio_pin": pin_changed_count,
            "ultimo_usuario": last_user_info,
            "denominaciones": denoms_map,
            "usuarios": users_table,
            "auditoria": audit_table
        }