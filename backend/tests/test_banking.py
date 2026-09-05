import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.app.core.security import generate_totp_token
from backend.app.hardware.serial_controller import serial_controller

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_vault_stock():
    # Ensure vault has stock for Q1, Q5, Q10, Q20, Q50, Q100, Q200
    tok = generate_totp_token()
    login_res = client.post("/api/auth/login", json={
        "card_number": "9999888877776666",
        "pin": "1234",
        "token": tok,
        "is_admin": True
    })
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}
    client.post("/api/admin/vault/initialize", headers=headers, json={
        "bills": {"200": 20, "100": 25, "50": 20, "20": 50, "10": 50, "5": 50, "1": 100} # Total Q9,750 <= Q10,000
    })

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
    assert data["user"]["nombre_completo"] == "Carlos Gómez (Empleado 1)"

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
        "bills": {"200": 20, "100": 25, "50": 20, "20": 50, "10": 50, "5": 50, "1": 100} # Q9,750
    })
    assert init_ok.status_code == 200
    assert init_ok.json()["total_boveda"] == 9350.00

    # Test add cash exceeding Q30,000 capacity
    add_fail = client.post("/api/admin/vault/add-cash", headers=headers, json={
        "bills": {"200": 150} # 30,000 + 9,750 = 39,750 > 30,000
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