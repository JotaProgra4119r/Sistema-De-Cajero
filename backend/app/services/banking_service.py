import json
import random
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.db.models import (
    Usuario, Tarjeta, Role, Cajero, DenominacionCajero, ArqueoCajero, Transaccion, LogAuditoria, RegistroEliminado
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
    def calculate_optimal_dispense(amount: int, vault_stock: Dict[int, int]) -> Optional[Dict[str, int]]:
        """
        Algoritmo de Programación Dinámica y Backtracking con Branch-and-Bound:
        Calcula la combinación exacta de billetes en Quetzales para cualquier monto escalar
        (incluyendo montos impares no estándar como Q123.00, Q239.00), respetando estrictamente
        el inventario físico disponible en la bóveda por denominación.
        """
        if amount <= 0:
            return {}

        sorted_denoms = sorted([d for d in VALID_DENOMINATIONS if vault_stock.get(d, 0) > 0], reverse=True)
        memo = {}

        def backtrack(rem: int, idx: int) -> Optional[Dict[int, int]]:
            if rem == 0:
                return {}
            if idx >= len(sorted_denoms):
                return None
            state = (rem, idx)
            if state in memo:
                return memo[state]

            d = sorted_denoms[idx]
            max_can_use = min(rem // d, vault_stock.get(d, 0))

            for count in range(max_can_use, -1, -1):
                sub_res = backtrack(rem - count * d, idx + 1)
                if sub_res is not None:
                    res = dict(sub_res)
                    if count > 0:
                        res[d] = count
                    memo[state] = res
                    return res

            memo[state] = None
            return None

        result = backtrack(amount, 0)
        if result is None:
            return None
        return {str(k): v for k, v in result.items()}

    @staticmethod
    def authenticate(db: Session, card_number: str, pin: str, token: str, is_admin_mode: bool, id_cajero: str = "ATM-001") -> Dict[str, Any]:
        clean_card = card_number.replace("-", "").strip()
        if len(clean_card) != 16 or not clean_card.isdigit():
            raise HTTPException(status_code=400, detail="El número de tarjeta debe tener exactamente 16 dígitos numéricos.")
        
        card = db.query(Tarjeta).filter(
            Tarjeta.numero_tarjeta == clean_card,
            Tarjeta.activa == True,
            Tarjeta.is_deleted == False
        ).first()
        if not card:
            raise HTTPException(status_code=401, detail="Tarjeta no encontrada, inactiva o dada de baja.")
        
        user = card.usuario
        if not user or not user.activo or user.is_deleted:
            raise HTTPException(status_code=401, detail="Usuario no encontrado, inactivo o dado de baja.")
        
        is_super = user.rol.nombre_rol in ["SUPERADMIN", "SUPERADMINISTRADOR"]
        is_admin = user.rol.nombre_rol in ["ADMINISTRADOR", "SUPERADMIN", "SUPERADMINISTRADOR"]

        if is_admin_mode and not is_admin:
            raise HTTPException(status_code=403, detail="Acceso denegado: Se requieren credenciales de Administrador.")
        
        # Validación de Bóveda Vacía (Q0.00) para el cajero específico:
        # Si la bóveda de este cajero está en Q0.00, ningún usuario bancario normal puede operar en este cajero
        # hasta que un administrador inicialice este cajero con efectivo.
        if not is_admin_mode:
            vault_denoms = db.query(DenominacionCajero).filter(DenominacionCajero.id_cajero == id_cajero).all()
            total_vault = sum(d.denominacion * d.cantidad_billetes for d in vault_denoms)
            if total_vault <= 0:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Cajero {id_cajero} fuera de servicio: Bóveda completamente vacía (Q0.00). Debe ser abastecido e inicializado por un administrador para permitir el acceso a usuarios."
                )

        if not verify_pin(pin, user.pin_hash):
            raise HTTPException(status_code=401, detail="PIN de seguridad incorrecto.")
        
        # Verify dynamic TOTP token (enforces anti-replay protection)
        if not verify_totp_token(token):
            raise HTTPException(status_code=401, detail="Token dinámico de seguridad inválido, expirado o ya consumido.")
        
        # Update last access
        user.fecha_ultimo_acceso = datetime.now(timezone.utc)
        db.commit()

        # Generate JWT with embedded TOTP reference for immediate invalidation on logout
        access_token = create_access_token({
            "sub": str(user.id_usuario),
            "role": user.rol.nombre_rol,
            "card": clean_card,
            "name": user.nombre_completo,
            "totp": str(token).strip(),
            "id_cajero": id_cajero
        })

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id_usuario": user.id_usuario,
                "nombre_completo": user.nombre_completo,
                "rol": user.rol.nombre_rol,
                "is_superadmin": is_super,
                "tarjeta": clean_card,
                "id_cuenta_bancaria": user.id_cuenta_bancaria or "N/A",
                "id_cajero": id_cajero,
                "saldo_actual": float(user.saldo_actual),
                "monto_max_diario": float(user.monto_max_diario),
                "total_retirado_hoy": float(user.total_retirado_hoy),
                "cupo_disponible": max(0.0, float(user.monto_max_diario) - float(user.total_retirado_hoy)),
                "cambio_pin_realizado": user.cambio_pin_realizado
            }
        }

    @staticmethod
    def get_user_summary(db: Session, user_id: int, id_cajero: str = "ATM-001") -> Dict[str, Any]:
        user = db.query(Usuario).filter(Usuario.id_usuario == user_id, Usuario.is_deleted == False).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado o inactivo.")
        active_card = next((c.numero_tarjeta for c in user.tarjetas if c.activa and not c.is_deleted), "N/A")
        
        # Fetch vault stock and total for user denomination selection in current ATM
        vault_denoms = db.query(DenominacionCajero).filter(DenominacionCajero.id_cajero == id_cajero).all()
        stock_map = {d.denominacion: d.cantidad_billetes for d in vault_denoms}
        total_vault = sum(d.denominacion * d.cantidad_billetes for d in vault_denoms)

        cajero_obj = db.query(Cajero).filter(Cajero.id_cajero == id_cajero).first()
        cajero_nombre = cajero_obj.nombre if cajero_obj else id_cajero
        
        return {
            "id_usuario": user.id_usuario,
            "nombre_completo": user.nombre_completo,
            "tarjeta": active_card,
            "id_cuenta_bancaria": user.id_cuenta_bancaria or "N/A",
            "id_cajero": id_cajero,
            "cajero_nombre": cajero_nombre,
            "saldo_actual": float(user.saldo_actual),
            "monto_max_diario": float(user.monto_max_diario),
            "total_retirado_hoy": float(user.total_retirado_hoy),
            "cupo_disponible": max(0.0, float(user.monto_max_diario) - float(user.total_retirado_hoy)),
            "cambio_pin_realizado": user.cambio_pin_realizado,
            "stock_boveda": stock_map,
            "total_boveda": float(total_vault)
        }

    @staticmethod
    async def withdraw_custom(db: Session, user_id: int, amount: float, bills: Dict[str, int], id_cajero: str = "ATM-001") -> Dict[str, Any]:
        if amount <= 0:
            raise HTTPException(status_code=400, detail="El monto de retiro debe ser mayor a cero.")
        
        user = db.query(Usuario).filter(Usuario.id_usuario == user_id, Usuario.is_deleted == False).with_for_update().first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado o cuenta inactiva.")
        
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
        
        # 3. Determinación y consistencia de desglose físico en el cajero específico
        vault_records = {
            d.denominacion: d for d in db.query(DenominacionCajero).filter(
                DenominacionCajero.id_cajero == id_cajero
            ).with_for_update().all()
        }
        stock_map = {d.denominacion: d.cantidad_billetes for d in vault_records.values()}

        clean_bills = {}
        if not bills or sum(bills.values()) == 0:
            optimal = BankingService.calculate_optimal_dispense(int(amount), stock_map)
            if not optimal:
                raise HTTPException(
                    status_code=400,
                    detail=f"Inventario físico insuficiente en {id_cajero}: No es posible dispensar exactamente Q{amount:.2f} con los billetes disponibles en bóveda."
                )
            clean_bills = optimal
        else:
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

        # 4. Verificación y reserva atómica de existencias físicas en la bóveda del cajero
        for denom_str, count in clean_bills.items():
            d = int(denom_str)
            rec = vault_records.get(d)
            if not rec or rec.cantidad_billetes < count:
                disp = rec.cantidad_billetes if rec else 0
                raise HTTPException(
                    status_code=400,
                    detail=f"Inventario físico insuficiente en {id_cajero} para billetes de Q{d}. Disponibles: {disp}, solicitados: {count}."
                )
        
        # 5. Coordinación física de despacho con microcontrolador Arduino Mega 2560
        dispense_res = await serial_controller.dispense(clean_bills)
        if dispense_res.get("status") != "SUCCESS":
            err_code = dispense_res.get("code", "ERROR_DESCONOCIDO")
            log_err = LogAuditoria(
                id_usuario=user.id_usuario,
                accion="FALLO_DISPENSACION_FISICA",
                detalles=f"Error en hardware en cajero {id_cajero}: {err_code}. Monto solicitado Q{amount:.2f}. No se aplicaron débitos contables.",
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

        # Decrement vault inventory for this ATM
        for denom_str, count in clean_bills.items():
            d = int(denom_str)
            vault_records[d].cantidad_billetes -= count

        # Register transaction
        now = datetime.now()
        tx = Transaccion(
            id_cajero=id_cajero,
            id_usuario=user.id_usuario,
            tipo_transaccion="RETIRO",
            monto=amount,
            fecha_hora=now,
            desglose_billetes=clean_bills
        )
        db.add(tx)

        # Audit log
        log = LogAuditoria(
            id_usuario=user.id_usuario,
            accion="RETIRO_EFECTIVO",
            detalles=f"Retiro exitoso de Q{amount:.2f} en cajero {id_cajero} con desglose {clean_bills}.",
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
        if id_cajero == "ATM-001":
            inv_dict = {d.denominacion: d.cantidad_billetes for d in vault_records.values()}
            await txt_manager.update_inventario(inv_dict)
        await txt_manager.append_transaccion(tx.id_transaccion, user.id_usuario, "RETIRO", amount, clean_bills, now)
        await txt_manager.append_auditoria(log.id_log, user.id_usuario, log.accion, log.detalles, now)

        return {
            "status": "SUCCESS",
            "mensaje": f"Retiro de Q{amount:.2f} completado con éxito.",
            "id_transaccion": tx.id_transaccion,
            "id_cajero": id_cajero,
            "monto": amount,
            "desglose": clean_bills,
            "nuevo_saldo": float(user.saldo_actual),
            "cupo_disponible": max(0.0, float(user.monto_max_diario) - float(user.total_retirado_hoy)),
            "fecha_hora": now.strftime("%Y-%m-%d %H:%M:%S")
        }

    @staticmethod
    async def deposit_custom(db: Session, user_id: int, bills: Dict[str, int], id_cajero: str = "ATM-001") -> Dict[str, Any]:
        user = db.query(Usuario).filter(Usuario.id_usuario == user_id, Usuario.is_deleted == False).with_for_update().first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado o cuenta inactiva.")

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

        vault_records = {
            d.denominacion: d for d in db.query(DenominacionCajero).filter(
                DenominacionCajero.id_cajero == id_cajero
            ).with_for_update().all()
        }
        current_vault_total = sum(d.denominacion * d.cantidad_billetes for d in vault_records.values())
        if current_vault_total + total_deposit > MAX_VAULT_CAPACITY:
            raise HTTPException(
                status_code=400,
                detail=f"La bóveda de {id_cajero} superaría la capacidad máxima permitida de Q{MAX_VAULT_CAPACITY:.2f}. Capacidad disponible: Q{MAX_VAULT_CAPACITY - current_vault_total:.2f}."
            )

        # Apply credit
        user.saldo_actual = float(user.saldo_actual) + total_deposit
        for denom_str, count in clean_bills.items():
            d = int(denom_str)
            if d in vault_records:
                vault_records[d].cantidad_billetes += count

        now = datetime.now()
        tx = Transaccion(
            id_cajero=id_cajero,
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
            detalles=f"Depósito exitoso de Q{total_deposit:.2f} en {id_cajero} desglosado: {clean_bills}.",
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
        if id_cajero == "ATM-001":
            inv_dict = {d.denominacion: d.cantidad_billetes for d in vault_records.values()}
            await txt_manager.update_inventario(inv_dict)
        await txt_manager.append_transaccion(tx.id_transaccion, user.id_usuario, "DEPOSITO", total_deposit, clean_bills, now)
        await txt_manager.append_auditoria(log.id_log, user.id_usuario, log.accion, log.detalles, now)

        return {
            "status": "SUCCESS",
            "mensaje": f"Depósito de Q{total_deposit:.2f} realizado con éxito en {id_cajero}.",
            "id_transaccion": tx.id_transaccion,
            "id_cajero": id_cajero,
            "monto": total_deposit,
            "desglose": clean_bills,
            "nuevo_saldo": float(user.saldo_actual),
            "fecha_hora": now.strftime("%Y-%m-%d %H:%M:%S")
        }

    @staticmethod
    def lookup_account(db: Session, account_id: str) -> Dict[str, Any]:
        """Consulta y valida la existencia de una cuenta bancaria por su ID/Token de 8 dígitos."""
        clean_id = str(account_id).strip()
        user = db.query(Usuario).filter(
            Usuario.id_cuenta_bancaria == clean_id,
            Usuario.is_deleted == False,
            Usuario.activo == True
        ).first()
        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"Cuenta con ID {clean_id} no encontrada en la red bancaria o no se encuentra activa."
            )
        return {
            "found": True,
            "id_cuenta": user.id_cuenta_bancaria,
            "nombre_completo": user.nombre_completo,
            "rol": user.rol.nombre_rol
        }

    @staticmethod
    async def deposit_to_third_party(
        db: Session,
        sender_user_id: int,
        target_account_id: str,
        bills: Dict[str, int],
        id_cajero: str = "ATM-001"
    ) -> Dict[str, Any]:
        """
        Depósito en efectivo a otra cuenta bancaria en la red (interbancario / intercajero en la nube).
        Acredita el saldo al titular destinatario especificado por su ID de 8 dígitos, e ingresa
        las piezas físicas al cajero donde se encuentra el cliente.
        """
        sender = db.query(Usuario).filter(Usuario.id_usuario == sender_user_id, Usuario.is_deleted == False).first()
        if not sender:
            raise HTTPException(status_code=404, detail="Usuario remitente no encontrado.")
        
        clean_target_id = str(target_account_id).strip()
        target_user = db.query(Usuario).filter(
            Usuario.id_cuenta_bancaria == clean_target_id,
            Usuario.is_deleted == False,
            Usuario.activo == True
        ).with_for_update().first()
        if not target_user:
            raise HTTPException(
                status_code=404,
                detail=f"Cuenta destinataria con ID {clean_target_id} no existe en la red bancaria o se encuentra inactiva."
            )

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

        vault_records = {
            d.denominacion: d for d in db.query(DenominacionCajero).filter(
                DenominacionCajero.id_cajero == id_cajero
            ).with_for_update().all()
        }
        current_vault_total = sum(d.denominacion * d.cantidad_billetes for d in vault_records.values())
        if current_vault_total + total_deposit > MAX_VAULT_CAPACITY:
            raise HTTPException(
                status_code=400,
                detail=f"La bóveda del cajero {id_cajero} superaría su capacidad máxima de Q{MAX_VAULT_CAPACITY:.2f}."
            )

        # Acreditar saldo a la cuenta de destino en SQL
        target_user.saldo_actual = float(target_user.saldo_actual) + total_deposit
        for denom_str, count in clean_bills.items():
            d = int(denom_str)
            if d in vault_records:
                vault_records[d].cantidad_billetes += count

        now = datetime.now()
        tx = Transaccion(
            id_cajero=id_cajero,
            id_usuario=sender.id_usuario,
            tipo_transaccion="DEPOSITO_A_TERCERO",
            monto=total_deposit,
            fecha_hora=now,
            desglose_billetes=clean_bills,
            id_cuenta_destino=clean_target_id,
            nombre_destinatario=target_user.nombre_completo
        )
        db.add(tx)

        log = LogAuditoria(
            id_usuario=sender.id_usuario,
            accion="DEPOSITO_INTERBANCARIO_TERCERO",
            detalles=f"Depósito de Q{total_deposit:.2f} en cajero {id_cajero} hacia cuenta {clean_target_id} ({target_user.nombre_completo}). Desglose: {clean_bills}.",
            fecha_hora=now
        )
        db.add(log)
        db.commit()
        db.refresh(tx)
        db.refresh(log)

        # Dual write de actualización
        active_card_target = next((c.numero_tarjeta for c in target_user.tarjetas if c.activa), "N/A")
        await txt_manager.update_usuario(
            target_user.id_usuario, target_user.nombre_completo, active_card_target, target_user.pin_hash,
            float(target_user.saldo_actual), float(target_user.monto_max_diario), float(target_user.total_retirado_hoy),
            target_user.cambio_pin_realizado, target_user.fecha_ultimo_acceso
        )
        if id_cajero == "ATM-001":
            inv_dict = {d.denominacion: d.cantidad_billetes for d in vault_records.values()}
            await txt_manager.update_inventario(inv_dict)
        await txt_manager.append_transaccion(tx.id_transaccion, sender.id_usuario, "DEPOSITO_A_TERCERO", total_deposit, clean_bills, now)
        await txt_manager.append_auditoria(log.id_log, sender.id_usuario, log.accion, log.detalles, now)

        return {
            "status": "SUCCESS",
            "mensaje": f"Depósito interbancario de Q{total_deposit:.2f} acreditado con éxito a {target_user.nombre_completo}.",
            "id_transaccion": tx.id_transaccion,
            "monto": total_deposit,
            "id_cajero": id_cajero,
            "desglose": clean_bills,
            "remitente": sender.nombre_completo,
            "destinatario_nombre": target_user.nombre_completo,
            "destinatario_cuenta": clean_target_id,
            "saldo_remitente": float(sender.saldo_actual),
            "fecha_hora": now.strftime("%Y-%m-%d %H:%M:%S")
        }

    @staticmethod
    async def change_pin(db: Session, user_id: int, card_number: str, current_pin: str, new_pin: str, token: str = "") -> Dict[str, Any]:
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
        
        if token and not verify_totp_token(token):
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

        active_card = next((c.numero_tarjeta for c in user.tarjetas if c.activa), "N/A")
        await txt_manager.update_usuario(
            user.id_usuario, user.nombre_completo, active_card, user.pin_hash,
            float(user.saldo_actual), float(user.monto_max_diario), float(user.total_retirado_hoy),
            user.cambio_pin_realizado, user.fecha_ultimo_acceso
        )
        await txt_manager.append_auditoria(log.id_log, user.id_usuario, log.accion, log.detalles)

        return {"status": "SUCCESS", "mensaje": "PIN confidencial actualizado correctamente."}

    # ==========================
    # SECCIÓN ADMINISTRATIVA Y MULTICAJERO
    # ==========================
    @staticmethod
    async def vault_initialize(db: Session, admin_user_id: int, bills: Dict[str, int], id_cajero: str = "ATM-001") -> Dict[str, Any]:
        """Inicializa ÚNICAMENTE la bóveda del cajero individual seleccionado."""
        total_init = sum(int(d) * int(c) for d, c in bills.items() if int(d) in VALID_DENOMINATIONS)
        if total_init <= 0:
            raise HTTPException(
                status_code=400,
                detail="El monto de inicialización debe ser mayor a Q0.00. Ingrese piezas para al menos una denominación."
            )
        if total_init > MAX_VAULT_INIT:
            raise HTTPException(
                status_code=400,
                detail=f"La inicialización no puede sobrepasar el límite estricto de Q{MAX_VAULT_INIT:.2f}. Total ingresado: Q{total_init:.2f}."
            )
        
        vault_records = {
            d.denominacion: d for d in db.query(DenominacionCajero).filter(
                DenominacionCajero.id_cajero == id_cajero
            ).all()
        }
        for d in VALID_DENOMINATIONS:
            cnt = int(bills.get(str(d), bills.get(d, 0)))
            if cnt < 0:
                raise HTTPException(status_code=400, detail="La cantidad de piezas no puede ser negativa.")
            if d in vault_records:
                vault_records[d].cantidad_billetes = cnt
            else:
                new_d = DenominacionCajero(id_cajero=id_cajero, denominacion=d, cantidad_billetes=cnt)
                db.add(new_d)
                vault_records[d] = new_d

        cajero = db.query(Cajero).filter(Cajero.id_cajero == id_cajero).first()
        if cajero:
            cajero.is_initialized = True
            cajero.estado = "ACTIVO"

        db.query(Usuario).update({Usuario.total_retirado_hoy: 0.00})

        arq = ArqueoCajero(
            id_cajero=id_cajero,
            tipo_evento="INICIALIZACION",
            monto_total=total_init,
            fecha_evento=datetime.now()
        )
        db.add(arq)

        log = LogAuditoria(
            id_usuario=admin_user_id,
            accion="INICIALIZACION_BOVEDA",
            detalles=f"Inicialización de bóveda para cajero {id_cajero} completada con Q{total_init:.2f}.",
            fecha_hora=datetime.now()
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        if id_cajero == "ATM-001":
            inv_dict = {d.denominacion: d.cantidad_billetes for d in vault_records.values()}
            await txt_manager.update_inventario(inv_dict)
        await txt_manager.append_auditoria(log.id_log, admin_user_id, log.accion, log.detalles)
        await txt_manager.sync_all_from_db(db)

        return {
            "status": "SUCCESS",
            "mensaje": f"Bóveda de {id_cajero} inicializada con éxito por un total de Q{total_init:.2f}.",
            "id_cajero": id_cajero,
            "total_boveda": total_init,
            "desglose": bills
        }

    @staticmethod
    async def vault_initialize_all(db: Session, admin_user_id: int, bills: Optional[Dict[str, int]] = None) -> Dict[str, Any]:
        """
        Función exclusiva de Superadministrador:
        Inicializa simultáneamente la totalidad de cajeros de la red bancaria con lote estándar o provisto.
        """
        default_bills = bills or {"200": 20, "100": 25, "50": 20, "20": 50, "10": 50, "5": 50, "1": 100}
        total_per_atm = sum(int(d) * int(c) for d, c in default_bills.items() if int(d) in VALID_DENOMINATIONS)
        if total_per_atm > MAX_VAULT_INIT:
            raise HTTPException(status_code=400, detail=f"El monto por cajero excede el límite de Q{MAX_VAULT_INIT:.2f}.")

        all_cajeros = db.query(Cajero).all()
        initialized_names = []
        now = datetime.now()

        for cajero in all_cajeros:
            vault_records = {
                d.denominacion: d for d in db.query(DenominacionCajero).filter(
                    DenominacionCajero.id_cajero == cajero.id_cajero
                ).all()
            }
            for d in VALID_DENOMINATIONS:
                cnt = int(default_bills.get(str(d), default_bills.get(d, 0)))
                if d in vault_records:
                    vault_records[d].cantidad_billetes = cnt
                else:
                    new_rec = DenominacionCajero(id_cajero=cajero.id_cajero, denominacion=d, cantidad_billetes=cnt)
                    db.add(new_rec)
                    vault_records[d] = new_rec
            cajero.is_initialized = True
            cajero.estado = "ACTIVO"

            arq = ArqueoCajero(
                id_cajero=cajero.id_cajero,
                tipo_evento="INICIALIZACION",
                monto_total=total_per_atm,
                fecha_evento=now
            )
            db.add(arq)
            initialized_names.append(f"{cajero.id_cajero} ({cajero.nombre})")

        db.query(Usuario).update({Usuario.total_retirado_hoy: 0.00})

        log = LogAuditoria(
            id_usuario=admin_user_id,
            accion="SUPERADMIN_INICIALIZACION_GLOBAL",
            detalles=f"Superadministrador inicializó simultáneamente {len(all_cajeros)} cajeros con Q{total_per_atm:.2f} c/u (Total Red: Q{total_per_atm * len(all_cajeros):.2f}).",
            fecha_hora=now
        )
        db.add(log)
        db.commit()

        inv_001 = {
            d.denominacion: d.cantidad_billetes for d in db.query(DenominacionCajero).filter(
                DenominacionCajero.id_cajero == "ATM-001"
            ).all()
        }
        if inv_001:
            await txt_manager.update_inventario(inv_001)
        await txt_manager.append_auditoria(log.id_log, admin_user_id, log.accion, log.detalles)
        await txt_manager.sync_all_from_db(db)

        return {
            "status": "SUCCESS",
            "mensaje": f"Se inicializaron con éxito todos los {len(all_cajeros)} cajeros de la red simultáneamente.",
            "cajeros_afectados": initialized_names,
            "monto_por_cajero": total_per_atm,
            "total_red_inyectado": total_per_atm * len(all_cajeros),
            "desglose": default_bills
        }

    @staticmethod
    async def vault_add_cash(db: Session, admin_user_id: int, bills: Dict[str, int], id_cajero: str = "ATM-001") -> Dict[str, Any]:
        last_init = db.query(ArqueoCajero).filter(
            ArqueoCajero.id_cajero == id_cajero,
            ArqueoCajero.tipo_evento == "INICIALIZACION"
        ).first()
        if not last_init:
            raise HTTPException(status_code=400, detail=f"El cajero {id_cajero} debe ser inicializado previamente antes de agregar efectivo.")

        vault_records = {
            d.denominacion: d for d in db.query(DenominacionCajero).filter(
                DenominacionCajero.id_cajero == id_cajero
            ).all()
        }
        current_total = sum(d.denominacion * d.cantidad_billetes for d in vault_records.values())
        added_total = sum(int(d) * int(c) for d, c in bills.items() if int(d) in VALID_DENOMINATIONS)

        if added_total <= 0:
            raise HTTPException(status_code=400, detail="El monto a agregar debe ser mayor a Q0.00.")

        if current_total + added_total > MAX_VAULT_CAPACITY:
            raise HTTPException(
                status_code=400,
                detail=f"Capacidad máxima de bóveda (Q{MAX_VAULT_CAPACITY:.2f}) superada. Saldo actual: Q{current_total:.2f}, intentó agregar: Q{added_total:.2f}."
            )

        for d in VALID_DENOMINATIONS:
            cnt = int(bills.get(str(d), bills.get(d, 0)))
            if cnt < 0:
                raise HTTPException(status_code=400, detail="La cantidad de piezas no puede ser negativa.")
            if d in vault_records:
                vault_records[d].cantidad_billetes += cnt
            else:
                new_d = DenominacionCajero(id_cajero=id_cajero, denominacion=d, cantidad_billetes=cnt)
                db.add(new_d)
                vault_records[d] = new_d

        new_total = current_total + added_total

        arq = ArqueoCajero(
            id_cajero=id_cajero,
            tipo_evento="RECARGA",
            monto_total=added_total,
            fecha_evento=datetime.now()
        )
        db.add(arq)

        log = LogAuditoria(
            id_usuario=admin_user_id,
            accion="RECARGA_BOVEDA",
            detalles=f"Recarga de efectivo en cajero {id_cajero} por Q{added_total:.2f}. Nuevo saldo en bóveda: Q{new_total:.2f}.",
            fecha_hora=datetime.now()
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        if id_cajero == "ATM-001":
            inv_dict = {d.denominacion: d.cantidad_billetes for d in vault_records.values()}
            await txt_manager.update_inventario(inv_dict)
        await txt_manager.append_auditoria(log.id_log, admin_user_id, log.accion, log.detalles)

        return {
            "status": "SUCCESS",
            "mensaje": f"Se agregaron Q{added_total:.2f} a la bóveda de {id_cajero} exitosamente.",
            "id_cajero": id_cajero,
            "total_boveda": new_total,
            "monto_agregado": added_total,
            "desglose_agregado": bills
        }

    @staticmethod
    async def vault_reset(db: Session, admin_user_id: int, id_cajero: str = "ATM-001") -> Dict[str, Any]:
        """Restablece toda la bóveda y variables de un cajero individual a cero (Q0.00)."""
        vault_records = {
            d.denominacion: d for d in db.query(DenominacionCajero).filter(
                DenominacionCajero.id_cajero == id_cajero
            ).all()
        }
        for d in VALID_DENOMINATIONS:
            if d in vault_records:
                vault_records[d].cantidad_billetes = 0
            else:
                new_d = DenominacionCajero(id_cajero=id_cajero, denominacion=d, cantidad_billetes=0)
                db.add(new_d)
                vault_records[d] = new_d

        cajero = db.query(Cajero).filter(Cajero.id_cajero == id_cajero).first()
        if cajero:
            cajero.is_initialized = False

        db.query(ArqueoCajero).filter(
            ArqueoCajero.id_cajero == id_cajero,
            ArqueoCajero.tipo_evento == "INICIALIZACION"
        ).update({ArqueoCajero.tipo_evento: "INICIALIZACION_REINICIADA"})

        arq = ArqueoCajero(
            id_cajero=id_cajero,
            tipo_evento="REINICIO_BOVEDA",
            monto_total=0.00,
            fecha_evento=datetime.now()
        )
        db.add(arq)

        log = LogAuditoria(
            id_usuario=admin_user_id,
            accion="REINICIO_BOVEDA",
            detalles=f"Reinicio de bóveda de {id_cajero} a cero (Q0.00).",
            fecha_hora=datetime.now()
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        if id_cajero == "ATM-001":
            inv_dict = {d: 0 for d in VALID_DENOMINATIONS}
            await txt_manager.update_inventario(inv_dict)
        await txt_manager.append_auditoria(log.id_log, admin_user_id, log.accion, log.detalles)
        await txt_manager.sync_all_from_db(db)

        return {
            "status": "SUCCESS",
            "mensaje": f"Bóveda de {id_cajero} reiniciada a cero (Q0.00) exitosamente.",
            "id_cajero": id_cajero,
            "total_boveda": 0.0,
            "desglose": {str(d): 0 for d in VALID_DENOMINATIONS}
        }

    @staticmethod
    async def admin_register_employee(
        db: Session,
        admin_user_id: int,
        name: str,
        card_number: str,
        pin: str,
        initial_balance: float,
        max_daily: float
    ) -> Dict[str, Any]:
        clean_card = card_number.replace("-", "").strip()
        if len(clean_card) != 16 or not clean_card.isdigit():
            raise HTTPException(status_code=400, detail="El número de tarjeta debe tener 16 dígitos numéricos.")
        if len(pin) != 4 or not pin.isdigit():
            raise HTTPException(status_code=400, detail="El PIN debe tener 4 dígitos numéricos.")
        
        exists_card = db.query(Tarjeta).filter(Tarjeta.numero_tarjeta == clean_card).first()
        if exists_card:
            raise HTTPException(status_code=400, detail="El número de tarjeta ya se encuentra asignado en el sistema.")

        # Generar ID de cuenta único de al menos 8 dígitos
        while True:
            new_acct_id = str(random.randint(10000000, 99999999))
            if not db.query(Usuario).filter(Usuario.id_cuenta_bancaria == new_acct_id).first():
                break

        new_user = Usuario(
            id_rol=2, # USUARIO
            nombre_completo=name.strip(),
            id_cuenta_bancaria=new_acct_id,
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
            detalles=f"Registro de nuevo empleado {name} (ID Cuenta: {new_acct_id}) con tarjeta {clean_card}, saldo Q{initial_balance:.2f}, límite Q{max_daily:.2f}.",
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

        return {
            "status": "SUCCESS",
            "mensaje": f"Empleado {name} registrado con éxito con ID de cuenta {new_acct_id}.",
            "id_usuario": new_user.id_usuario,
            "id_cuenta_bancaria": new_acct_id
        }

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
            detalles=f"Reasignación de plástico a usuario {user.nombre_completo} (ID {user.id_usuario}). Nueva tarjeta: {clean_card}.",
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
    async def admin_change_pin(db: Session, admin_user_id: int, user_id: int, new_pin: str) -> Dict[str, Any]:
        clean_pin = str(new_pin).strip()
        if not clean_pin.isdigit() or len(clean_pin) != 4:
            raise HTTPException(status_code=400, detail="El nuevo PIN debe contener exactamente 4 dígitos numéricos.")

        user = db.query(Usuario).filter(Usuario.id_usuario == user_id, Usuario.is_deleted == False).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado o dado de baja.")

        user.pin_hash = get_pin_hash(clean_pin)
        user.cambio_pin_realizado = True

        log = LogAuditoria(
            id_usuario=admin_user_id,
            accion="ADMIN_CAMBIO_PIN",
            detalles=f"El administrador actualizó el PIN del empleado {user.nombre_completo} (ID: {user.id_usuario}).",
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

        return {"status": "SUCCESS", "mensaje": f"PIN de {user.nombre_completo} actualizado correctamente desde modo administrador."}

    # ==========================
    # SECCIÓN DE SOFT DELETE
    # ==========================
    @staticmethod
    async def soft_delete_user(db: Session, operator_user_id: int, user_id: int, motivo: str) -> Dict[str, Any]:
        user = db.query(Usuario).filter(Usuario.id_usuario == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")
        if user.is_deleted:
            raise HTTPException(status_code=400, detail="El usuario ya se encuentra dado de baja lógicamente.")

        # Proteger superadministradores de bajas accidentales
        if user.rol.nombre_rol in ["SUPERADMIN", "SUPERADMINISTRADOR"]:
            raise HTTPException(status_code=403, detail="Las cuentas de Superadministrador están protegidas y no pueden ser dadas de baja.")

        operator = db.query(Usuario).filter(Usuario.id_usuario == operator_user_id).first()
        op_name = operator.nombre_completo if operator else "ADMINISTRADOR"

        cards_data = [{"id_tarjeta": c.id_tarjeta, "numero": c.numero_tarjeta, "activa": c.activa} for c in user.tarjetas]
        snapshot = {
            "id_usuario": user.id_usuario,
            "nombre_completo": user.nombre_completo,
            "id_cuenta_bancaria": user.id_cuenta_bancaria,
            "saldo_actual": float(user.saldo_actual),
            "monto_max_diario": float(user.monto_max_diario),
            "tarjetas": cards_data
        }

        now = datetime.now()
        user.is_deleted = True
        user.activo = False
        user.deleted_at = now
        user.deleted_by_id = operator_user_id

        for c in user.tarjetas:
            c.is_deleted = True
            c.activa = False
            c.deleted_at = now

        registro_eliminado = RegistroEliminado(
            tabla_origen="usuarios",
            id_registro_origen=user.id_usuario,
            datos_eliminados_json=snapshot,
            motivo=motivo,
            eliminado_por_id=operator_user_id,
            eliminado_por_nombre=op_name,
            id_usuario_afectado=user.id_usuario,
            visible_para_usuario=True,
            fecha_eliminacion=now
        )
        db.add(registro_eliminado)

        log = LogAuditoria(
            id_usuario=operator_user_id,
            accion="BAJA_LOGICA_USUARIO",
            detalles=f"Baja lógica de usuario {user.nombre_completo} (ID: {user.id_usuario}). Motivo: {motivo}.",
            fecha_hora=now
        )
        db.add(log)
        db.commit()
        db.refresh(registro_eliminado)
        db.refresh(log)

        await txt_manager.append_registro_eliminado(
            registro_eliminado.id_eliminacion, "usuarios", user.id_usuario, motivo, op_name, user.id_usuario, now
        )
        await txt_manager.append_auditoria_eliminacion(
            user.id_usuario, operator_user_id, motivo, snapshot, now
        )
        await txt_manager.append_auditoria(log.id_log, operator_user_id, log.accion, log.detalles, now)
        await txt_manager.sync_all_from_db(db)

        return {
            "status": "SUCCESS",
            "mensaje": f"Usuario {user.nombre_completo} dado de baja lógicamente con éxito.",
            "id_eliminacion": registro_eliminado.id_eliminacion,
            "fecha_eliminacion": now.strftime("%Y-%m-%d %H:%M:%S")
        }

    @staticmethod
    def get_user_deleted_records(db: Session, user_id: int) -> List[Dict[str, Any]]:
        records = db.query(RegistroEliminado).filter(
            RegistroEliminado.id_usuario_afectado == user_id,
            RegistroEliminado.visible_para_usuario == True
        ).order_by(RegistroEliminado.fecha_eliminacion.desc()).all()
        results = []
        for r in records:
            results.append({
                "id_eliminacion": r.id_eliminacion,
                "tabla_origen": r.tabla_origen,
                "motivo": r.motivo,
                "eliminado_por": r.eliminado_por_nombre or "ADMINISTRACION",
                "fecha_eliminacion": r.fecha_eliminacion.strftime("%Y-%m-%d %H:%M:%S") if r.fecha_eliminacion else "",
                "detalles": r.datos_eliminados_json
            })
        return results

    @staticmethod
    def get_all_deleted_records(db: Session) -> List[Dict[str, Any]]:
        records = db.query(RegistroEliminado).order_by(RegistroEliminado.fecha_eliminacion.desc()).all()
        results = []
        for r in records:
            results.append({
                "id_eliminacion": r.id_eliminacion,
                "tabla_origen": r.tabla_origen,
                "id_registro_origen": r.id_registro_origen,
                "motivo": r.motivo,
                "eliminado_por_id": r.eliminado_por_id,
                "eliminado_por": r.eliminado_por_nombre or "ADMINISTRACION",
                "id_usuario_afectado": r.id_usuario_afectado,
                "fecha_eliminacion": r.fecha_eliminacion.strftime("%Y-%m-%d %H:%M:%S") if r.fecha_eliminacion else "",
                "datos_archivados": r.datos_eliminados_json
            })
        return results

    @staticmethod
    def get_admin_metrics(db: Session, id_cajero: str = "ATM-001") -> Dict[str, Any]:
        """Métricas orientadas al Cajero seleccionado y supervisión local."""
        vault_records = db.query(DenominacionCajero).filter(
            DenominacionCajero.id_cajero == id_cajero
        ).order_by(DenominacionCajero.denominacion.desc()).all()
        total_vault = sum(d.denominacion * d.cantidad_billetes for d in vault_records)
        denoms_map = {d.denominacion: d.cantidad_billetes for d in vault_records}

        vault_gauge = min(100.0, (total_vault / MAX_VAULT_CAPACITY) * 100.0)
        total_retirado_hoy = db.query(func.sum(Usuario.total_retirado_hoy)).filter(Usuario.is_deleted == False).scalar() or 0.0

        avg_deposits = db.query(func.avg(Transaccion.monto)).filter(
            Transaccion.tipo_transaccion.in_(["DEPOSITO", "DEPOSITO_A_TERCERO"])
        ).scalar() or 0.0
        avg_withdrawals = db.query(func.avg(Transaccion.monto)).filter(Transaccion.tipo_transaccion == "RETIRO").scalar() or 0.0
        total_withdrawals = db.query(func.sum(Transaccion.monto)).filter(Transaccion.tipo_transaccion == "RETIRO").scalar() or 0.0
        total_deposits = db.query(func.sum(Transaccion.monto)).filter(
            Transaccion.tipo_transaccion.in_(["DEPOSITO", "DEPOSITO_A_TERCERO"])
        ).scalar() or 0.0
        count_withdrawals = db.query(func.count(Transaccion.id_transaccion)).filter(Transaccion.tipo_transaccion == "RETIRO").scalar() or 0
        count_deposits = db.query(func.count(Transaccion.id_transaccion)).filter(
            Transaccion.tipo_transaccion.in_(["DEPOSITO", "DEPOSITO_A_TERCERO"])
        ).scalar() or 0

        all_txs_raw = db.query(Transaccion).order_by(Transaccion.fecha_hora.asc()).all()
        daily_groups: Dict[str, Dict[str, Any]] = {}
        for t in all_txs_raw:
            d_str = t.fecha_hora.strftime("%Y-%m-%d") if t.fecha_hora else "Hoy"
            if d_str not in daily_groups:
                daily_groups[d_str] = {
                    "fecha": d_str,
                    "retiros": 0.0,
                    "depositos": 0.0,
                    "conteo_retiros": 0,
                    "conteo_depositos": 0,
                    "promedio_retiro": 0.0,
                    "promedio_deposito": 0.0
                }
            if t.tipo_transaccion == "RETIRO":
                daily_groups[d_str]["retiros"] += float(t.monto)
                daily_groups[d_str]["conteo_retiros"] += 1
            else:
                daily_groups[d_str]["depositos"] += float(t.monto)
                daily_groups[d_str]["conteo_depositos"] += 1

        for g in daily_groups.values():
            if g["conteo_retiros"] > 0:
                g["promedio_retiro"] = round(g["retiros"] / g["conteo_retiros"], 2)
            if g["conteo_depositos"] > 0:
                g["promedio_deposito"] = round(g["depositos"] / g["conteo_depositos"], 2)

        historico_diario = list(daily_groups.values())
        if not historico_diario:
            today_str = datetime.now().strftime("%Y-%m-%d")
            historico_diario = [{
                "fecha": today_str,
                "retiros": 0.0,
                "depositos": 0.0,
                "conteo_retiros": 0,
                "conteo_depositos": 0,
                "promedio_retiro": 0.0,
                "promedio_deposito": 0.0
            }]

        cajero_obj = db.query(Cajero).filter(Cajero.id_cajero == id_cajero).first()
        is_init = cajero_obj.is_initialized if cajero_obj else (total_vault > 0)
        if total_vault <= 0:
            init_status = "Bóveda en Cero (Pendiente)"
        else:
            init_status = "Inicializado" if is_init else "Pendiente"

        pin_changed_count = db.query(Usuario).filter(Usuario.cambio_pin_realizado == True, Usuario.is_deleted == False).count()
        last_user = db.query(Usuario).filter(Usuario.is_deleted == False).order_by(Usuario.fecha_ultimo_acceso.desc().nullslast()).first()
        last_user_info = {
            "nombre": last_user.nombre_completo if last_user else "Ninguno",
            "timestamp": last_user.fecha_ultimo_acceso.strftime("%Y-%m-%d %H:%M:%S") if (last_user and last_user.fecha_ultimo_acceso) else "Sin accesos"
        }

        # Conteo exclusivo de Superusuarios
        super_count = db.query(Usuario).filter(Usuario.id_rol == 3, Usuario.is_deleted == False).count()

        # Users table (EXCLUYENDO SUPERADMINISTRADORES según requerimiento)
        users = db.query(Usuario).all()
        users_table = []
        for u in users:
            # Requerimiento: "Ese superusuario no tendría que aparecer en la categoría maestra de usuarios y empleados"
            if u.rol.nombre_rol in ["SUPERADMIN", "SUPERADMINISTRADOR"]:
                continue
            active_card = next((c.numero_tarjeta for c in u.tarjetas if c.activa and not c.is_deleted), "N/A")
            users_table.append({
                "id_usuario": u.id_usuario,
                "nombre_completo": u.nombre_completo,
                "id_cuenta_bancaria": u.id_cuenta_bancaria or "N/A",
                "tarjeta": active_card,
                "saldo_actual": float(u.saldo_actual),
                "monto_max_diario": float(u.monto_max_diario),
                "total_retirado_hoy": float(u.total_retirado_hoy),
                "ultimo_acceso": u.fecha_ultimo_acceso.strftime("%Y-%m-%d %H:%M:%S") if u.fecha_ultimo_acceso else "Nunca",
                "cambio_pin_realizado": u.cambio_pin_realizado,
                "rol": u.rol.nombre_rol,
                "is_deleted": u.is_deleted,
                "deleted_at": u.deleted_at.strftime("%Y-%m-%d %H:%M:%S") if u.deleted_at else None
            })

        # Red de Cajeros
        all_cajeros = db.query(Cajero).all()
        cajeros_summary = []
        for c in all_cajeros:
            c_denoms = db.query(DenominacionCajero).filter(DenominacionCajero.id_cajero == c.id_cajero).all()
            c_vault = sum(d.denominacion * d.cantidad_billetes for d in c_denoms)
            cajeros_summary.append({
                "id_cajero": c.id_cajero,
                "nombre": c.nombre,
                "ubicacion": c.ubicacion,
                "estado": c.estado,
                "is_initialized": c.is_initialized,
                "total_boveda": float(c_vault)
            })

        logs = db.query(LogAuditoria).order_by(LogAuditoria.fecha_hora.desc()).limit(100).all()
        audit_table = [{
            "id_log": l.id_log,
            "id_usuario": l.id_usuario,
            "accion": l.accion,
            "detalles": l.detalles,
            "fecha_hora": l.fecha_hora.strftime("%Y-%m-%d %H:%M:%S")
        } for l in logs]

        txs = db.query(Transaccion).order_by(Transaccion.fecha_hora.desc()).limit(100).all()
        txs_table = []
        for t in txs:
            u = t.usuario
            card = next((c.numero_tarjeta for c in u.tarjetas if c.activa and not c.is_deleted), "N/A") if u else "N/A"
            txs_table.append({
                "id_transaccion": t.id_transaccion,
                "id_cajero": t.id_cajero or "ATM-001",
                "id_usuario": t.id_usuario,
                "nombre_usuario": u.nombre_completo if u else "Usuario Desconocido",
                "tarjeta": card,
                "tipo": t.tipo_transaccion,
                "monto": float(t.monto),
                "desglose": t.desglose_billetes,
                "id_cuenta_destino": t.id_cuenta_destino,
                "nombre_destinatario": t.nombre_destinatario,
                "fecha_hora": t.fecha_hora.strftime("%Y-%m-%d %H:%M:%S") if t.fecha_hora else ""
            })

        return {
            "id_cajero": id_cajero,
            "cajero_nombre": cajero_obj.nombre if cajero_obj else id_cajero,
            "saldo_boveda": total_vault,
            "capacidad_maxima_boveda": MAX_VAULT_CAPACITY,
            "porcentaje_boveda": vault_gauge,
            "total_retirado_hoy": float(total_retirado_hoy),
            "promedio_depositos": float(avg_deposits),
            "promedio_retiros": float(avg_withdrawals),
            "total_retiros": float(total_withdrawals),
            "total_depositos": float(total_deposits),
            "conteo_retiros": int(count_withdrawals),
            "conteo_depositos": int(count_deposits),
            "historico_diario": historico_diario,
            "distribucion_operaciones": {
                "retiros_total": float(total_withdrawals),
                "depositos_total": float(total_deposits),
                "conteo_retiros": int(count_withdrawals),
                "conteo_depositos": int(count_deposits)
            },
            "estado_inicializacion": init_status,
            "usuarios_cambio_pin": pin_changed_count,
            "ultimo_usuario": last_user_info,
            "superusuarios_count": int(super_count),
            "denominaciones": denoms_map,
            "cajeros": cajeros_summary,
            "usuarios": users_table,
            "auditoria": audit_table,
            "transacciones": txs_table
        }

    @staticmethod
    def get_superadmin_metrics(db: Session) -> Dict[str, Any]:
        """Dashboard consolidado para el Superadministrador: métricas simultáneas de todos los cajeros."""
        now = datetime.now(timezone.utc)
        today_date_str = datetime.now().strftime("%Y-%m-%d")
        all_cajeros = db.query(Cajero).all()
        cajeros_details = []
        global_vault_total = 0.0
        global_withdrawals_total = 0.0
        global_deposits_total = 0.0
        global_transfers_total = 0.0
        global_withdrawals_count = 0
        global_deposits_count = 0
        global_transfers_count = 0

        # Totales del día
        salidas_hoy_red = 0.0
        conteo_salidas_hoy_red = 0
        entradas_hoy_red = 0.0
        conteo_entradas_hoy_red = 0
        transferencias_hoy_red = 0.0
        conteo_transferencias_hoy_red = 0

        cajeros_iniciados_count = 0

        for c in all_cajeros:
            # Estado en línea (activo si en_linea=True y latido reciente dentro de 180s)
            is_online = False
            if c.en_linea:
                if c.ultimo_latido:
                    dt_lat = c.ultimo_latido if c.ultimo_latido.tzinfo else c.ultimo_latido.replace(tzinfo=timezone.utc)
                    if (now - dt_lat).total_seconds() <= 180:
                        is_online = True
                else:
                    is_online = True
            if is_online:
                cajeros_iniciados_count += 1

            c_denoms = db.query(DenominacionCajero).filter(DenominacionCajero.id_cajero == c.id_cajero).all()
            c_vault = sum(d.denominacion * d.cantidad_billetes for d in c_denoms)
            global_vault_total += c_vault

            # Transacciones de este cajero
            c_txs = db.query(Transaccion).filter(Transaccion.id_cajero == c.id_cajero).all()
            
            c_withdr_sum = sum(float(t.monto) for t in c_txs if t.tipo_transaccion == "RETIRO")
            c_withdr_cnt = sum(1 for t in c_txs if t.tipo_transaccion == "RETIRO")
            c_dep_sum = sum(float(t.monto) for t in c_txs if t.tipo_transaccion in ["DEPOSITO", "DEPOSITO_A_TERCERO"])
            c_dep_cnt = sum(1 for t in c_txs if t.tipo_transaccion in ["DEPOSITO", "DEPOSITO_A_TERCERO"])
            c_trf_sum = sum(float(t.monto) for t in c_txs if t.tipo_transaccion == "DEPOSITO_A_TERCERO")
            c_trf_cnt = sum(1 for t in c_txs if t.tipo_transaccion == "DEPOSITO_A_TERCERO")

            # Hoy
            c_txs_today = [t for t in c_txs if t.fecha_hora and t.fecha_hora.strftime("%Y-%m-%d") == today_date_str]
            c_salidas_hoy = sum(float(t.monto) for t in c_txs_today if t.tipo_transaccion == "RETIRO")
            c_cnt_salidas_hoy = sum(1 for t in c_txs_today if t.tipo_transaccion == "RETIRO")
            c_entradas_hoy = sum(float(t.monto) for t in c_txs_today if t.tipo_transaccion in ["DEPOSITO", "DEPOSITO_A_TERCERO"])
            c_cnt_entradas_hoy = sum(1 for t in c_txs_today if t.tipo_transaccion in ["DEPOSITO", "DEPOSITO_A_TERCERO"])
            c_trf_hoy = sum(float(t.monto) for t in c_txs_today if t.tipo_transaccion == "DEPOSITO_A_TERCERO")
            c_cnt_trf_hoy = sum(1 for t in c_txs_today if t.tipo_transaccion == "DEPOSITO_A_TERCERO")

            global_withdrawals_total += c_withdr_sum
            global_deposits_total += c_dep_sum
            global_transfers_total += c_trf_sum
            global_withdrawals_count += c_withdr_cnt
            global_deposits_count += c_dep_cnt
            global_transfers_count += c_trf_cnt

            salidas_hoy_red += c_salidas_hoy
            conteo_salidas_hoy_red += c_cnt_salidas_hoy
            entradas_hoy_red += c_entradas_hoy
            conteo_entradas_hoy_red += c_cnt_entradas_hoy
            transferencias_hoy_red += c_trf_hoy
            conteo_transferencias_hoy_red += c_cnt_trf_hoy

            cajeros_details.append({
                "id_cajero": c.id_cajero,
                "nombre": c.nombre,
                "ubicacion": c.ubicacion,
                "estado": c.estado,
                "is_initialized": c.is_initialized,
                "en_linea": is_online,
                "codigo_cajero": c.codigo_cajero or "1234",
                "ultimo_latido": c.ultimo_latido.strftime("%Y-%m-%d %H:%M:%S") if c.ultimo_latido else "",
                "total_boveda": float(c_vault),
                "total_salidas": float(c_withdr_sum),
                "conteo_salidas": int(c_withdr_cnt),
                "total_entradas": float(c_dep_sum),
                "conteo_entradas": int(c_dep_cnt),
                "total_transferencias": float(c_trf_sum),
                "conteo_transferencias": int(c_trf_cnt),
                "salidas_hoy": float(c_salidas_hoy),
                "conteo_salidas_hoy": int(c_cnt_salidas_hoy),
                "entradas_hoy": float(c_entradas_hoy),
                "conteo_entradas_hoy": int(c_cnt_entradas_hoy),
                "transferencias_hoy": float(c_trf_hoy),
                "conteo_transferencias_hoy": int(c_cnt_trf_hoy),
                "total_transacciones": int(c_withdr_cnt + c_dep_cnt),
                "denominaciones": {d.denominacion: d.cantidad_billetes for d in c_denoms}
            })

        super_count = db.query(Usuario).filter(Usuario.id_rol == 3, Usuario.is_deleted == False).count()
        normal_users_count = db.query(Usuario).filter(Usuario.id_rol == 2, Usuario.is_deleted == False).count()

        # Saldo total de todas las cuentas bancarias alojadas en la nube/SQL
        saldo_cuentas_total = db.query(func.sum(Usuario.saldo_actual)).filter(
            Usuario.activo == True,
            Usuario.is_deleted == False
        ).scalar() or 0.0

        recent_txs = db.query(Transaccion).order_by(Transaccion.fecha_hora.desc()).limit(150).all()
        txs_list = []
        for t in recent_txs:
            u = t.usuario
            txs_list.append({
                "id_transaccion": t.id_transaccion,
                "id_cajero": t.id_cajero or "ATM-001",
                "id_usuario": t.id_usuario,
                "nombre_usuario": u.nombre_completo if u else "Desconocido",
                "tipo": t.tipo_transaccion,
                "monto": float(t.monto),
                "desglose": t.desglose_billetes,
                "id_cuenta_destino": t.id_cuenta_destino,
                "nombre_destinatario": t.nombre_destinatario,
                "fecha_hora": t.fecha_hora.strftime("%Y-%m-%d %H:%M:%S") if t.fecha_hora else ""
            })

        return {
            "total_cajeros": len(all_cajeros),
            "cajeros_iniciados": int(cajeros_iniciados_count),
            "cajeros_apagados": int(len(all_cajeros) - cajeros_iniciados_count),
            "cajeros_operativos": sum(1 for c in all_cajeros if c.is_initialized),
            "boveda_total_red": float(global_vault_total),
            "saldo_total_cuentas_alojadas": float(saldo_cuentas_total),
            "salidas_hoy_red": float(salidas_hoy_red),
            "conteo_salidas_hoy_red": int(conteo_salidas_hoy_red),
            "entradas_hoy_red": float(entradas_hoy_red),
            "conteo_entradas_hoy_red": int(conteo_entradas_hoy_red),
            "transferencias_hoy_red": float(transferencias_hoy_red),
            "conteo_transferencias_hoy_red": int(conteo_transferencias_hoy_red),
            "salidas_totales_red": float(global_withdrawals_total),
            "entradas_totales_red": float(global_deposits_total),
            "conteo_salidas_red": int(global_withdrawals_count),
            "conteo_entradas_red": int(global_deposits_count),
            "conteo_transacciones_red": int(global_withdrawals_count + global_deposits_count),
            "superusuarios_count": int(super_count),
            "usuarios_activos_count": int(normal_users_count),
            "cajeros": cajeros_details,
            "transacciones_recientes": txs_list
        }

    @staticmethod
    async def connect_atm(db: Session, id_cajero: str, codigo_cajero: str, session_id: str, force: bool = False) -> Dict[str, Any]:
        """
        Conecta un cajero terminal existente al sistema.
        Verifica el código de seguridad de 4 dígitos y valida la exclusividad de sesión
        para evitar que dos terminales usen el mismo cajero simultáneamente.
        """
        cajero = db.query(Cajero).filter(Cajero.id_cajero == id_cajero).first()
        if not cajero:
            raise HTTPException(status_code=404, detail=f"Cajero con ID '{id_cajero}' no encontrado en la red bancaria.")

        clean_code = str(codigo_cajero).strip()
        expected_code = str(cajero.codigo_cajero or "1234").strip()
        if clean_code != expected_code:
            raise HTTPException(status_code=401, detail="Código de seguridad de 4 dígitos incorrecto para este cajero.")

        # Validar si ya hay una sesión activa en otra terminal
        now = datetime.now(timezone.utc)
        if cajero.en_linea and cajero.sesion_activa_id and cajero.sesion_activa_id != session_id:
            # Comprobar si el último latido es reciente (menos de 90 segundos)
            if cajero.ultimo_latido:
                dt_latido = cajero.ultimo_latido
                if dt_latido.tzinfo is None:
                    dt_latido = dt_latido.replace(tzinfo=timezone.utc)
                diff_sec = (now - dt_latido).total_seconds()
                if diff_sec < 90 and not force:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Acceso denegado: El '{cajero.nombre}' ({cajero.id_cajero}) ya cuenta con una sesión activa en otra terminal (última actividad hace {int(diff_sec)}s). Solo se permite un operador activo simultáneamente."
                    )

        cajero.en_linea = True
        cajero.sesion_activa_id = session_id
        cajero.ultimo_latido = now
        db.commit()

        # Registrar log de auditoría
        log = LogAuditoria(
            id_usuario=None,
            accion="ATM_SESION_CONECTADA",
            detalles=f"Cajero {cajero.id_cajero} ({cajero.nombre}) conectado y enlazado a sesión {session_id[:8]}...",
            fecha_hora=now
        )
        db.add(log)
        db.commit()

        try:
            await txt_manager.sync_cajeros(db)
        except Exception as e:
            print(f"[TXT_MANAGER] Error syncing cajeros: {e}")

        v_denoms = db.query(DenominacionCajero).filter(DenominacionCajero.id_cajero == cajero.id_cajero).all()
        v_total = sum(d.denominacion * d.cantidad_billetes for d in v_denoms)

        return {
            "status": "SUCCESS",
            "mensaje": f"Cajero '{cajero.nombre}' ({cajero.id_cajero}) enlazado y puesto en línea exitosamente.",
            "cajero": {
                "id_cajero": cajero.id_cajero,
                "nombre": cajero.nombre,
                "ubicacion": cajero.ubicacion,
                "estado": cajero.estado,
                "is_initialized": cajero.is_initialized,
                "en_linea": True,
                "vault_total": float(v_total),
                "sesion_activa_id": session_id
            }
        }

    @staticmethod
    async def register_atm(db: Session, nombre: str, codigo_cajero: str, ubicacion: Optional[str], session_id: str) -> Dict[str, Any]:
        """
        Primer Inicio: Registra e inicializa un nuevo cajero en la red con nombre personalizado
        y código de 4 dígitos. Escala dinámicamente el número de cajeros en el sistema.
        """
        clean_name = str(nombre).strip()
        if not clean_name or len(clean_name) < 3:
            raise HTTPException(status_code=400, detail="El nombre del cajero debe tener al menos 3 caracteres (ej. 'Cajero de José').")

        clean_code = str(codigo_cajero).strip()
        if not (clean_code.isdigit() and len(clean_code) == 4):
            raise HTTPException(status_code=400, detail="El código de seguridad del cajero debe consistir exactamente de 4 dígitos numéricos.")

        # Generar siguiente ID escalable
        all_cajeros = db.query(Cajero).all()
        nums = []
        for c in all_cajeros:
            if c.id_cajero.startswith("ATM-"):
                try:
                    nums.append(int(c.id_cajero.split("-")[1]))
                except ValueError:
                    pass
        next_num = (max(nums) + 1) if nums else (len(all_cajeros) + 1)
        new_atm_id = f"ATM-{next_num:03d}"

        now = datetime.now(timezone.utc)
        new_cajero = Cajero(
            id_cajero=new_atm_id,
            nombre=clean_name,
            ubicacion=str(ubicacion).strip() if ubicacion else "Sucursal General / Red Bancaria",
            estado="ACTIVO",
            is_initialized=False,
            codigo_cajero=clean_code,
            en_linea=True,
            sesion_activa_id=session_id,
            ultimo_latido=now,
            fecha_creacion=now
        )
        db.add(new_cajero)
        db.flush()

        # Denominaciones inicializadas en 0
        for denom in VALID_DENOMINATIONS:
            db.add(DenominacionCajero(
                id_cajero=new_atm_id,
                denominacion=denom,
                cantidad_billetes=0
            ))

        log = LogAuditoria(
            id_usuario=None,
            accion="ATM_CREADO_Y_ENLAZADO",
            detalles=f"Nuevo cajero {new_atm_id} registrado como '{clean_name}' con código de 4 dígitos y enlazado.",
            fecha_hora=now
        )
        db.add(log)
        db.commit()

        try:
            await txt_manager.sync_cajeros(db)
        except Exception as e:
            print(f"[TXT_MANAGER] Error syncing cajeros: {e}")

        return {
            "status": "SUCCESS",
            "mensaje": f"Cajero '{clean_name}' ({new_atm_id}) registrado y conectado exitosamente.",
            "cajero": {
                "id_cajero": new_atm_id,
                "nombre": clean_name,
                "ubicacion": new_cajero.ubicacion,
                "estado": new_cajero.estado,
                "is_initialized": False,
                "en_linea": True,
                "vault_total": 0.0,
                "sesion_activa_id": session_id
            }
        }

    @staticmethod
    def heartbeat_atm(db: Session, id_cajero: str, session_id: str) -> Dict[str, Any]:
        """Actualiza el latido (keepalive) de la sesión del cajero."""
        cajero = db.query(Cajero).filter(Cajero.id_cajero == id_cajero).first()
        if not cajero:
            return {"status": "NOT_FOUND"}
        now = datetime.now(timezone.utc)
        if not cajero.sesion_activa_id or cajero.sesion_activa_id == session_id:
            cajero.ultimo_latido = now
            cajero.en_linea = True
            cajero.sesion_activa_id = session_id
            db.commit()
        return {"status": "ONLINE", "id_cajero": id_cajero, "timestamp": now.isoformat()}

    @staticmethod
    async def disconnect_atm(db: Session, id_cajero: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Libera la sesión y apaga el cajero."""
        cajero = db.query(Cajero).filter(Cajero.id_cajero == id_cajero).first()
        if not cajero:
            return {"status": "NOT_FOUND"}
        now = datetime.now(timezone.utc)
        cajero.en_linea = False
        cajero.sesion_activa_id = None
        cajero.ultimo_latido = now
        db.commit()

        log = LogAuditoria(
            id_usuario=None,
            accion="ATM_SESION_DESCONECTADA",
            detalles=f"Cajero {cajero.id_cajero} ({cajero.nombre}) apagado / desconectado formalmente.",
            fecha_hora=now
        )
        db.add(log)
        db.commit()

        try:
            await txt_manager.sync_cajeros(db)
        except Exception:
            pass

        return {
            "status": "SUCCESS",
            "mensaje": f"Cajero '{cajero.nombre}' ({cajero.id_cajero}) ha sido apagado/desconectado correctamente."
        }

    @staticmethod
    def get_cajero_detailed_report(db: Session, id_cajero: str) -> Dict[str, Any]:
        """
        Provee al Superagente el despliegue profundo de los datos de un cajero específico:
        transferencias del día, retiros, depósitos, inventario de denominaciones y auditoría.
        """
        cajero = db.query(Cajero).filter(Cajero.id_cajero == id_cajero).first()
        if not cajero:
            raise HTTPException(status_code=404, detail=f"Cajero '{id_cajero}' no encontrado.")

        today_date_str = datetime.now().strftime("%Y-%m-%d")

        # Denominaciones y Bóveda
        denoms = db.query(DenominacionCajero).filter(DenominacionCajero.id_cajero == id_cajero).all()
        total_vault = sum(d.denominacion * d.cantidad_billetes for d in denoms)

        # Transacciones de este cajero
        txs = db.query(Transaccion).filter(Transaccion.id_cajero == id_cajero).order_by(Transaccion.fecha_hora.desc()).all()

        txs_today = [t for t in txs if t.fecha_hora and t.fecha_hora.strftime("%Y-%m-%d") == today_date_str]

        salidas_hoy = sum(float(t.monto) for t in txs_today if t.tipo_transaccion == "RETIRO")
        entradas_hoy = sum(float(t.monto) for t in txs_today if t.tipo_transaccion in ["DEPOSITO", "DEPOSITO_A_TERCERO"])
        transferencias_hoy = sum(float(t.monto) for t in txs_today if t.tipo_transaccion == "DEPOSITO_A_TERCERO")

        txs_formatted = []
        for t in txs[:100]:
            u = t.usuario
            txs_formatted.append({
                "id_transaccion": t.id_transaccion,
                "id_cajero": t.id_cajero,
                "id_usuario": t.id_usuario,
                "nombre_usuario": u.nombre_completo if u else "Desconocido",
                "tipo": t.tipo_transaccion,
                "monto": float(t.monto),
                "desglose": t.desglose_billetes,
                "id_cuenta_destino": t.id_cuenta_destino,
                "nombre_destinatario": t.nombre_destinatario,
                "fecha_hora": t.fecha_hora.strftime("%Y-%m-%d %H:%M:%S") if t.fecha_hora else ""
            })

        return {
            "cajero": {
                "id_cajero": cajero.id_cajero,
                "nombre": cajero.nombre,
                "ubicacion": cajero.ubicacion,
                "estado": cajero.estado,
                "is_initialized": cajero.is_initialized,
                "codigo_cajero": cajero.codigo_cajero or "1234",
                "en_linea": bool(cajero.en_linea),
                "ultimo_latido": cajero.ultimo_latido.strftime("%Y-%m-%d %H:%M:%S") if cajero.ultimo_latido else "",
                "total_boveda": float(total_vault),
                "denominaciones": {d.denominacion: d.cantidad_billetes for d in denoms}
            },
            "metricas_dia": {
                "salidas_hoy": float(salidas_hoy),
                "entradas_hoy": float(entradas_hoy),
                "transferencias_hoy": float(transferencias_hoy),
                "conteo_salidas_hoy": sum(1 for t in txs_today if t.tipo_transaccion == "RETIRO"),
                "conteo_entradas_hoy": sum(1 for t in txs_today if t.tipo_transaccion in ["DEPOSITO", "DEPOSITO_A_TERCERO"]),
                "conteo_transferencias_hoy": sum(1 for t in txs_today if t.tipo_transaccion == "DEPOSITO_A_TERCERO")
            },
            "transacciones": txs_formatted
        }

    @staticmethod
    def get_superadmin_consolidated_report(db: Session) -> Dict[str, Any]:
        """Genera el reporte consolidado global imprimible de toda la red de cajeros."""
        metrics = BankingService.get_superadmin_metrics(db)
        return {
            "fecha_reporte": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "titulo": "REPORTE CONSOLIDADO DE AUDITORÍA Y ARQUEO DE RED MULTICAJERO",
            "banco": "RED DE CAJEROS AUTOMÁTICOS MULTICAJERO GT",
            "metricas_globales": metrics,
            "cajeros": metrics["cajeros"],
            "transacciones": metrics["transacciones_recientes"]
        }
