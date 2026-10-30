import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.app.core.security import generate_totp_token, _consumed_totp_tokens, _blacklisted_totp_tokens
from database.connection import SessionLocal
from backend.app.db.models import Usuario, Cajero, DenominacionCajero

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_token_caches():
    _consumed_totp_tokens.clear()
    _blacklisted_totp_tokens.clear()

def test_multi_atm_independent_initialization():
    """Verifica que cada cajero mantenga su propio estado y bóveda independiente."""
    # 1. Resetear bóveda de ATM-002 a 0
    tok = generate_totp_token()
    login_admin = client.post("/api/auth/login", json={
        "card_number": "9999888877776666",
        "pin": "1234",
        "token": tok,
        "is_admin": True
    })
    assert login_admin.status_code == 200
    adm_headers = {"Authorization": f"Bearer {login_admin.json()['access_token']}"}

    # Reset ATM-002
    client.post("/api/admin/vault/reset?id_cajero=ATM-002", headers=adm_headers)

    # 2. Inicializar únicamente ATM-001
    _consumed_totp_tokens.clear()
    init_res = client.post("/api/admin/vault/initialize", headers=adm_headers, json={
        "bills": {"200": 10, "100": 10, "50": 10, "20": 20, "10": 20, "5": 20, "1": 50},
        "id_cajero": "ATM-001"
    })
    assert init_res.status_code == 200

    # 3. ATM-001 debe tener fondos, ATM-002 debe estar vacía
    st_001 = client.get("/api/auth/atm-status?id_cajero=ATM-001").json()
    st_002 = client.get("/api/auth/atm-status?id_cajero=ATM-002").json()

    assert st_001["vault_total"] > 0
    assert st_001["vault_empty"] is False
    assert st_002["vault_total"] == 0
    assert st_002["vault_empty"] is True

    # 4. Un usuario intentando acceder a ATM-002 debe ser rechazado
    _consumed_totp_tokens.clear()
    tok_user = generate_totp_token()
    user_login_002 = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "1234",
        "token": tok_user,
        "is_admin": False,
        "id_cajero": "ATM-002"
    })
    assert user_login_002.status_code == 403
    assert "ATM-002 fuera de servicio" in user_login_002.json()["detail"]

    # 5. El mismo usuario accediendo a ATM-001 debe tener acceso exitoso
    _consumed_totp_tokens.clear()
    tok_user_ok = generate_totp_token()
    user_login_001 = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "1234",
        "token": tok_user_ok,
        "is_admin": False,
        "id_cajero": "ATM-001"
    })
    assert user_login_001.status_code == 200
    assert user_login_001.json()["user"]["id_cuenta_bancaria"] == "10014528"

def test_superadmin_features_and_batch_initialization():
    """Verifica autenticación de Superadministrador, inicialización masiva y exclusión en lista de empleados."""
    # 1. Login con cuenta de prueba rápida de Superadministrador
    _consumed_totp_tokens.clear()
    tok = generate_totp_token()
    super_login = client.post("/api/auth/login", json={
        "card_number": "8888888888888888",
        "pin": "1234",
        "token": tok,
        "is_admin": True
    })
    assert super_login.status_code == 200
    user_data = super_login.json()["user"]
    assert user_data["rol"] == "SUPERADMIN"
    assert user_data["is_superadmin"] is True
    assert user_data["id_cuenta_bancaria"] == "88888888"

    super_headers = {"Authorization": f"Bearer {super_login.json()['access_token']}"}

    # 2. Inicialización simultánea de todos los cajeros de la red
    init_all_res = client.post("/api/admin/vault/initialize-all", headers=super_headers, json={
        "bills": {"200": 10, "100": 10, "50": 10, "20": 10, "10": 10, "5": 10, "1": 20}
    })
    assert init_all_res.status_code == 200
    assert len(init_all_res.json()["cajeros_afectados"]) >= 3

    # Verificar que ahora ATM-002 también tiene fondos
    st_002 = client.get("/api/auth/atm-status?id_cajero=ATM-002").json()
    assert st_002["vault_total"] > 0
    assert st_002["is_initialized"] is True

    # 3. Superadmin metrics endpoint
    super_metrics = client.get("/api/admin/super/metrics", headers=super_headers).json()
    assert super_metrics["total_cajeros"] >= 3
    assert super_metrics["superusuarios_count"] >= 1
    assert super_metrics["boveda_total_red"] > 0

    # 4. Verificar que en la lista regular de empleados el Superusuario NO aparece
    admin_metrics = client.get("/api/admin/metrics", headers=super_headers).json()
    assert admin_metrics["superusuarios_count"] >= 1
    employee_names = [u["nombre_completo"] for u in admin_metrics["usuarios"]]
    assert "Super Administrador Global" not in employee_names
    assert "Carlos Roberto Gómez" in employee_names

def test_account_lookup_and_interbank_deposit_with_8_digit_id():
    """Verifica consulta de cuentas por ID de 8 dígitos y depósitos a terceros."""
    # 1. Login con Carlos Roberto (Remitente)
    _consumed_totp_tokens.clear()
    tok = generate_totp_token()
    login_carlos = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "1234",
        "token": tok,
        "is_admin": False
    })
    assert login_carlos.status_code == 200
    carlos_headers = {"Authorization": f"Bearer {login_carlos.json()['access_token']}"}

    # 2. Consulta de cuenta de María Andrea López (ID: 20027819)
    lookup_res = client.get("/api/user/lookup-account?account_id=20027819", headers=carlos_headers)
    assert lookup_res.status_code == 200
    assert lookup_res.json()["nombre_completo"] == "María Andrea López"
    assert lookup_res.json()["id_cuenta"] == "20027819"

    # Consulta de cuenta inexistente
    lookup_fake = client.get("/api/user/lookup-account?account_id=99999998", headers=carlos_headers)
    assert lookup_fake.status_code == 404

    # Obtener saldo previo de María
    db = SessionLocal()
    maria_pre = db.query(Usuario).filter(Usuario.id_cuenta_bancaria == "20027819").first()
    saldo_pre = float(maria_pre.saldo_actual)
    db.close()

    # 3. Carlos realiza depósito a María de Q100 (1 billete de Q100)
    deposit_res = client.post("/api/user/deposit-to-account", headers=carlos_headers, json={
        "id_cuenta_destino": "20027819",
        "bills": {"100": 1}
    })
    assert deposit_res.status_code == 200
    dep_data = deposit_res.json()
    assert dep_data["status"] == "SUCCESS"
    assert dep_data["monto"] == 100.0
    assert dep_data["destinatario_nombre"] == "María Andrea López"
    assert dep_data["destinatario_cuenta"] == "20027819"

    # Verificar que el saldo de María subió en Q100 en la base de datos SQL
    db = SessionLocal()
    maria_post = db.query(Usuario).filter(Usuario.id_cuenta_bancaria == "20027819").first()
    assert float(maria_post.saldo_actual) == saldo_pre + 100.0
    db.close()

def test_register_employee_generates_8_digit_account_id():
    """Verifica que el alta de nuevos empleados genere un ID de cuenta bancario de 8 dígitos."""
    _consumed_totp_tokens.clear()
    tok = generate_totp_token()
    login_admin = client.post("/api/auth/login", json={
        "card_number": "9999888877776666",
        "pin": "1234",
        "token": tok,
        "is_admin": True
    })
    adm_headers = {"Authorization": f"Bearer {login_admin.json()['access_token']}"}

    import uuid
    dummy_card = str(uuid.uuid4().int)[:16]
    res = client.post("/api/admin/users/register", headers=adm_headers, json={
        "nombre_completo": "Test Nuevo Empleado Con ID",
        "numero_tarjeta": dummy_card,
        "pin": "1234",
        "saldo_inicial": 500.0,
        "monto_max_diario": 1000.0
    })
    assert res.status_code == 200
    data = res.json()
    assert "id_cuenta_bancaria" in data
    assert len(data["id_cuenta_bancaria"]) == 8
    assert data["id_cuenta_bancaria"].isdigit()
