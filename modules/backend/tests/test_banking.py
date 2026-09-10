import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.app.core.security import generate_totp_token, _consumed_totp_tokens, _blacklisted_totp_tokens
from backend.app.hardware.serial_controller import serial_controller

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_vault_stock():
    # Clear consumed and blacklisted TOTP token caches between test cases
    _consumed_totp_tokens.clear()
    _blacklisted_totp_tokens.clear()
    tok = generate_totp_token()
    login_res = client.post("/api/auth/login", json={
        "card_number": "9999888877776666",
        "pin": "1234",
        "token": tok,
        "is_admin": True
    })
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}
    client.post("/api/admin/vault/initialize", headers=headers, json={
        "bills": {"200": 20, "100": 25, "50": 20, "20": 50, "10": 50, "5": 50, "1": 100} # Total Q9,350 <= Q10,000
    })
    _consumed_totp_tokens.clear()
    _blacklisted_totp_tokens.clear()

def test_login_user_success():
    tok = generate_totp_token()
    res = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "1234",
        "token": tok,
        "is_admin": False
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert "Carlos" in data["user"]["nombre_completo"]

def test_login_invalid_pin():
    tok = generate_totp_token()
    res = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "9999", # Wrong PIN
        "token": tok,
        "is_admin": False
    })
    assert res.status_code == 401
    assert "incorrecto" in res.json()["detail"].lower()

def test_custom_withdrawal_q123():
    tok = generate_totp_token()
    login_res = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "1234",
        "token": tok,
        "is_admin": False
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    summary_before = client.get("/api/user/summary", headers=headers).json()
    saldo_before = summary_before["saldo_actual"]

    # Request arbitrary non-standard amount Q123.00: 1xQ100, 1xQ20, 3xQ1
    w_res = client.post("/api/user/withdraw", headers=headers, json={
        "amount": 123.00,
        "bills": {"100": 1, "20": 1, "1": 3}
    })
    assert w_res.status_code == 200, w_res.text
    w_data = w_res.json()
    assert w_data["status"] == "SUCCESS"
    assert w_data["monto"] == 123.00
    assert w_data["nuevo_saldo"] == saldo_before - 123.00

def test_custom_withdrawal_inconsistent_bills():
    tok = generate_totp_token()
    login_res = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "1234",
        "token": tok,
        "is_admin": False
    })
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    # Amount 123.00 but bills sum to 100.00 -> should reject
    w_res = client.post("/api/user/withdraw", headers=headers, json={
        "amount": 123.00,
        "bills": {"100": 1}
    })
    assert w_res.status_code == 400
    assert "aritmética" in w_res.json()["detail"].lower()

def test_daily_limit_exceeded():
    tok = generate_totp_token()
    login_res = client.post("/api/auth/login", json={
        "card_number": "3456789034567890",
        "pin": "1234",
        "token": tok,
        "is_admin": False
    })
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    # Juan Pérez has daily limit Q1500.00, attempt Q1600.00
    w_res = client.post("/api/user/withdraw", headers=headers, json={
        "amount": 1600.00,
        "bills": {"200": 8}
    })
    assert w_res.status_code == 400
    assert "límite diario" in w_res.json()["detail"].lower() or "saldo insuficiente" in w_res.json()["detail"].lower()

def test_deposit_and_last_transactions():
    tok = generate_totp_token()
    login_res = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "1234",
        "token": tok,
        "is_admin": False
    })
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    dep_res = client.post("/api/user/deposit", headers=headers, json={
        "bills": {"200": 2, "50": 2} # 400 + 100 = Q500.00
    })
    assert dep_res.status_code == 200
    assert dep_res.json()["monto"] == 500.00

    # Check last 5 transactions
    tx_res = client.get("/api/user/transactions", headers=headers)
    assert tx_res.status_code == 200
    txs = tx_res.json()
    assert len(txs) > 0
    assert txs[0]["tipo"] == "DEPOSITO"
    assert txs[0]["monto"] == 500.00

def test_admin_vault_rules():
    tok = generate_totp_token()
    login_res = client.post("/api/auth/login", json={
        "card_number": "9999888877776666",
        "pin": "1234",
        "token": tok,
        "is_admin": True
    })
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    # Test initialization exceeding Q10,000 limit -> must fail
    init_fail = client.post("/api/admin/vault/initialize", headers=headers, json={
        "bills": {"200": 60} # Q12,000 > Q10,000
    })
    assert init_fail.status_code == 400
    assert "límite estricto" in init_fail.json()["detail"].lower()

    # Test valid initialization
    init_ok = client.post("/api/admin/vault/initialize", headers=headers, json={
        "bills": {"200": 20, "100": 25, "50": 20, "20": 50, "10": 50, "5": 50, "1": 100} # Q9,350
    })
    assert init_ok.status_code == 200
    assert init_ok.json()["total_boveda"] == 9350.00

    # Test add cash exceeding Q30,000 capacity
    add_fail = client.post("/api/admin/vault/add-cash", headers=headers, json={
        "bills": {"200": 150} # 30,000 + 9,350 = 39,350 > 30,000
    })
    assert add_fail.status_code == 400
    assert "capacidad máxima" in add_fail.json()["detail"].lower() or "consolidado" in add_fail.json()["detail"].lower()

def test_jam_rollback():
    tok = generate_totp_token()
    login_res = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "1234",
        "token": tok,
        "is_admin": False
    })
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    summary_before = client.get("/api/user/summary", headers=headers).json()
    saldo_before = summary_before["saldo_actual"]

    serial_controller.set_simulate_jam(True)
    try:
        w_res = client.post("/api/user/withdraw", headers=headers, json={
            "amount": 100.00,
            "bills": {"100": 1}
        })
        assert w_res.status_code == 500
        assert "fallo mecánico" in w_res.json()["detail"].lower() or "jam" in w_res.json()["detail"].lower()

        summary_after = client.get("/api/user/summary", headers=headers).json()
        assert summary_after["saldo_actual"] == saldo_before
    finally:
        serial_controller.set_simulate_jam(False)

def test_totp_anti_replay_protection():
    """Verifies that consuming the same TOTP token twice triggers an anti-replay rejection."""
    _consumed_totp_tokens.clear()
    tok = generate_totp_token()
    res1 = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "1234",
        "token": tok,
        "is_admin": False
    })
    assert res1.status_code == 200

    # Replay attempt with same token
    res2 = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "1234",
        "token": tok,
        "is_admin": False
    })
    assert res2.status_code == 401
    assert "ya consumido" in res2.json()["detail"].lower() or "inválido" in res2.json()["detail"].lower()

def test_totp_immediate_invalidation_on_logout():
    """Verifies that invoking logout immediately purges and blacklists the TOTP token against replay attacks."""
    _consumed_totp_tokens.clear()
    _blacklisted_totp_tokens.clear()
    tok = generate_totp_token()
    
    # 1. Login exitoso
    res1 = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "1234",
        "token": tok,
        "is_admin": False
    })
    assert res1.status_code == 200
    access_token = res1.json()["access_token"]
    
    # 2. Cierre de sesión (logout) pasando token y Bearer JWT
    logout_res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {access_token}"}, json={
        "token": tok
    })
    assert logout_res.status_code == 200
    assert logout_res.json()["status"] == "SUCCESS"
    assert tok in logout_res.json()["purged_tokens"]

    # 3. Intento inmediato de re-login con el mismo token en su ventana temporal de 60s
    res_replay = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "1234",
        "token": tok,
        "is_admin": False
    })
    assert res_replay.status_code == 401
    assert "inválido" in res_replay.json()["detail"].lower() or "expirado" in res_replay.json()["detail"].lower()

    # 4. Probar invalidación de token demo explícitamente revocado
    demo_tok = "123456"
    logout_demo = client.post("/api/auth/logout", json={"token": demo_tok})
    assert logout_demo.status_code == 200
    assert demo_tok in logout_demo.json()["purged_tokens"]

    res_demo_relogin = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "1234",
        "token": demo_tok,
        "is_admin": False
    })
    assert res_demo_relogin.status_code == 401


def test_soft_delete_and_transparency_audit():
    """Verifies non-destructive soft deletion, immutable archiving, and user-facing visibility."""
    import time
    _consumed_totp_tokens.clear()
    admin_tok = generate_totp_token()
    admin_login = client.post("/api/auth/login", json={
        "card_number": "9999888877776666",
        "pin": "1234",
        "token": admin_tok,
        "is_admin": True
    })
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    unique_card = f"77{int(time.time() * 1000) % 100000000000000:014d}"

    # Register a temporary employee to soft-delete
    reg_res = client.post("/api/admin/users/register", headers=admin_headers, json={
        "nombre_completo": "Empleado Para Baja",
        "numero_tarjeta": unique_card,
        "pin": "4321",
        "saldo_inicial": 800.0,
        "monto_max_diario": 1000.0
    })
    assert reg_res.status_code == 200
    temp_user_id = reg_res.json()["id_usuario"]

    # Soft delete the employee
    del_res = client.post("/api/admin/users/soft-delete", headers=admin_headers, json={
        "id_usuario": temp_user_id,
        "motivo": "Fin de contrato laboral"
    })
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "SUCCESS"

    # Verify admin can inspect deleted records audit
    audit_res = client.get("/api/admin/audit/deleted-records", headers=admin_headers)
    assert audit_res.status_code == 200
    records = audit_res.json()
    assert any(r["id_usuario_afectado"] == temp_user_id for r in records)

    # Verify user login is now blocked
    _consumed_totp_tokens.clear()
    tok_user = generate_totp_token()
    login_blocked = client.post("/api/auth/login", json={
        "card_number": unique_card,
        "pin": "4321",
        "token": tok_user,
        "is_admin": False
    })
    assert login_blocked.status_code == 401
    assert "dada de baja" in login_blocked.json()["detail"].lower() or "inactiva" in login_blocked.json()["detail"].lower()
