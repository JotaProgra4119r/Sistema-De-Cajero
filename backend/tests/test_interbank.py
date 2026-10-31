import pytest
import asyncio
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.main import app
from backend.app.db.database import SessionLocal
from backend.app.db.models import Usuario, BancoRed, TransferenciaBancaria, Transaccion
from backend.app.services.interbank_service import interbank_manager
from backend.app.core.config import settings

import uuid

client = TestClient(app)

# Token global de prueba para evaluar primero creación y luego replay attack
SHARED_TEST_TOKEN = f"TRF-20261031-{uuid.uuid4().hex[:6].upper()}"

def test_tcp_ping():
    """Prueba que IB_PING responda con codigo '00', estado 'EN_LINEA' y cupo disponible."""
    async def _run():
        db = SessionLocal()
        try:
            req = {
                "tipo": "IB_PING",
                "cajero": "SERVER",
                "idMensaje": "TEST-PING-01",
                "timestamp": "2026-10-31 12:00:00",
                "bancoOrigen": "BANC01",
                "nombreBancoOrigen": "NEXUSBANK"
            }
            res = await interbank_manager._process_tcp_request("IB_PING", req, "TEST-PING-01", "10.219.19.9", db)
            assert res["tipo"] == "RESP_OK"
            assert res["codigo"] == "00"
            assert res["datos"]["codigoBanco"] == settings.BANK_CODE
            assert res["datos"]["estado"] == "EN_LINEA"
            assert res["datos"]["cupoDisponibleHoy"] > 0
        finally:
            db.close()
    asyncio.run(_run())

def test_tcp_verificar_cuenta_existente():
    """Prueba que IB_VERIFICAR_CUENTA devuelva codigo '00' y el nombreTitular correcto si la cuenta existe."""
    async def _run():
        db = SessionLocal()
        try:
            user = db.query(Usuario).filter(Usuario.id_cuenta_bancaria != None, Usuario.activo == True).first()
            assert user is not None

            req = {
                "tipo": "IB_VERIFICAR_CUENTA",
                "cajero": "SERVER",
                "idMensaje": "TEST-VERIF-01",
                "timestamp": "2026-10-31 12:00:00",
                "bancoOrigen": "BANC01",
                "bancoDestino": settings.BANK_CODE,
                "numeroCuenta": user.id_cuenta_bancaria
            }
            res = await interbank_manager._process_tcp_request("IB_VERIFICAR_CUENTA", req, "TEST-VERIF-01", "10.219.19.9", db)
            assert res["tipo"] == "RESP_OK"
            assert res["codigo"] == "00"
            assert res["datos"]["existe"] is True
            assert res["datos"]["nombreTitular"] == user.nombre_completo
        finally:
            db.close()
    asyncio.run(_run())

def test_tcp_verificar_cuenta_inexistente():
    """Prueba que IB_VERIFICAR_CUENTA devuelva codigo '14' si la cuenta no existe."""
    async def _run():
        db = SessionLocal()
        try:
            req = {
                "tipo": "IB_VERIFICAR_CUENTA",
                "cajero": "SERVER",
                "idMensaje": "TEST-VERIF-02",
                "timestamp": "2026-10-31 12:00:00",
                "bancoOrigen": "BANC01",
                "bancoDestino": settings.BANK_CODE,
                "numeroCuenta": "0000000009999999"
            }
            res = await interbank_manager._process_tcp_request("IB_VERIFICAR_CUENTA", req, "TEST-VERIF-02", "10.219.19.9", db)
            assert res["tipo"] == "RESP_OK"
            assert res["codigo"] == "14"
            assert res["datos"]["existe"] is False
            assert res["datos"]["nombreTitular"] == ""
        finally:
            db.close()
    asyncio.run(_run())

def test_tcp_transferir_exitoso_y_acreditacion():
    """Prueba que IB_TRANSFERIR acredite el saldo, descuente el cupo coordinado y registre el token TRF."""
    async def _run():
        db = SessionLocal()
        try:
            user = db.query(Usuario).filter(Usuario.id_cuenta_bancaria != None, Usuario.activo == True).first()
            saldo_inicial = float(user.saldo_actual)
            test_token = SHARED_TEST_TOKEN
            monto = 150.00

            req = {
                "tipo": "IB_TRANSFERIR",
                "cajero": "ATM-NEXUS-01",
                "idMensaje": "TEST-TRF-01",
                "timestamp": "2026-10-31 12:05:00",
                "tokenTransferencia": test_token,
                "bancoOrigen": "BANC01",
                "cuentaOrigen": "1000100010001000",
                "nombreOrigen": "Diego Remitente Nexus",
                "bancoDestino": settings.BANK_CODE,
                "cuentaDestino": user.id_cuenta_bancaria,
                "nombreDestino": user.nombre_completo,
                "monto": monto,
                "concepto": "Prueba Unitaria Interbancaria"
            }

            res = await interbank_manager._process_tcp_request("IB_TRANSFERIR", req, "TEST-TRF-01", "10.219.19.9", db)
            assert res["tipo"] == "RESP_OK"
            assert res["codigo"] == "00"
            assert res["datos"]["tokenTransferencia"] == test_token

            # Verificar saldo acreditado en BD
            db.refresh(user)
            assert float(user.saldo_actual) == saldo_inicial + monto

            # Verificar registro en transferencias_bancarias
            tx_saved = db.query(TransferenciaBancaria).filter(TransferenciaBancaria.token_transferencia == test_token).first()
            assert tx_saved is not None
            assert float(tx_saved.monto) == monto
            assert tx_saved.banco_origen == "BANC01"
            assert tx_saved.cuenta_destino == user.id_cuenta_bancaria

            # Verificar registro en transacciones de usuario
            tx_usr = db.query(Transaccion).filter(Transaccion.token_transferencia == test_token).first()
            assert tx_usr is not None
            assert tx_usr.tipo_transaccion == "TRANSFERENCIA_INTERBANCARIA"

        finally:
            db.close()
    asyncio.run(_run())

def test_tcp_transferir_replay_attack_rechazado():
    """Hardening: Prueba que un paquete IB_TRANSFERIR con un token ya procesado sea rechazado con código 94."""
    async def _run():
        db = SessionLocal()
        try:
            user = db.query(Usuario).filter(Usuario.id_cuenta_bancaria != None, Usuario.activo == True).first()
            test_token = SHARED_TEST_TOKEN # Reusar el mismo token de la prueba anterior
            saldo_antes = float(user.saldo_actual)

            req = {
                "tipo": "IB_TRANSFERIR",
                "cajero": "ATM-NEXUS-01",
                "idMensaje": "TEST-REPLAY-01",
                "timestamp": "2026-10-31 12:06:00",
                "tokenTransferencia": test_token,
                "bancoOrigen": "BANC01",
                "cuentaOrigen": "1000100010001000",
                "nombreOrigen": "Atacante Replay",
                "bancoDestino": settings.BANK_CODE,
                "cuentaDestino": user.id_cuenta_bancaria,
                "nombreDestino": user.nombre_completo,
                "monto": 150.00,
                "concepto": "Intento de Replay Attack"
            }

            res = await interbank_manager._process_tcp_request("IB_TRANSFERIR", req, "TEST-REPLAY-01", "10.219.19.9", db)
            assert res["codigo"] == "94"
            assert "duplicada" in res["mensaje"].lower() or "procesado" in res["mensaje"].lower()

            # Saldo NO debe haber aumentado
            db.refresh(user)
            assert float(user.saldo_actual) == saldo_antes
        finally:
            db.close()
    asyncio.run(_run())

def test_tcp_transferir_monto_negativo_rechazado():
    """Hardening: Prueba que montos negativos o <= 0 sean rechazados con código 12."""
    async def _run():
        db = SessionLocal()
        try:
            user = db.query(Usuario).filter(Usuario.id_cuenta_bancaria != None, Usuario.activo == True).first()
            test_token = "TRF-20261031-NEGATIVO01"

            req = {
                "tipo": "IB_TRANSFERIR",
                "cajero": "ATM-001",
                "idMensaje": "TEST-NEG-01",
                "timestamp": "2026-10-31 12:07:00",
                "tokenTransferencia": test_token,
                "bancoOrigen": "BANC01",
                "cuentaOrigen": "1000100010001000",
                "nombreOrigen": "Atacante",
                "bancoDestino": settings.BANK_CODE,
                "cuentaDestino": user.id_cuenta_bancaria,
                "monto": -500.00,
                "concepto": "Inyección Negativa"
            }

            res = await interbank_manager._process_tcp_request("IB_TRANSFERIR", req, "TEST-NEG-01", "10.219.19.9", db)
            assert res["codigo"] == "12"
            assert "inválido" in res["mensaje"].lower() or "positivo" in res["mensaje"].lower()
        finally:
            db.close()
    asyncio.run(_run())

def test_api_interbank_status_and_banks():
    """Prueba que los endpoints REST /api/interbank/status y /api/interbank/banks respondan 200 OK."""
    resp_status = client.get("/api/interbank/status")
    assert resp_status.status_code == 200
    data_status = resp_status.json()
    assert data_status["codigo_banco"] == settings.BANK_CODE
    assert data_status["puerto_tcp"] == 5000
    assert data_status["puerto_udp"] == 5005

    resp_banks = client.get("/api/interbank/banks")
    assert resp_banks.status_code == 200
    banks_list = resp_banks.json()
    assert isinstance(banks_list, list)
    assert any(b["codigo_banco"] == settings.BANK_CODE for b in banks_list)
    assert any(b["codigo_banco"] == "BANC01" for b in banks_list)

def test_api_interbank_verify_local_account():
    """Prueba la verificación de cuenta mediante la API REST."""
    db = SessionLocal()
    try:
        user = db.query(Usuario).filter(Usuario.id_cuenta_bancaria != None, Usuario.activo == True).first()
        assert user is not None
        acc = user.id_cuenta_bancaria
    finally:
        db.close()

    resp = client.post("/api/interbank/verify", json={
        "bank_code": settings.BANK_CODE,
        "account_number": acc
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["codigo"] == "00"
    assert data["datos"]["existe"] is True
