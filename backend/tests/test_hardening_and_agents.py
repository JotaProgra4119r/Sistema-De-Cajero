import os
import json
import time
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.app.core.security import generate_totp_token, _consumed_totp_tokens
from backend.app.services.banking_service import BankingService
from sensors.drivers.serial_controller import calculate_checksum, verify_and_parse_frame
from database.txt_manager import sanitize_flat_field, txt_manager
from agents import swarm_manager, event_bus

client = TestClient(app)

def test_dp_backtracking_optimal_dispense():
    """Valida el algoritmo DP/Backtracking para calcular desgloses exactos en denominaciones no convencionales."""
    # Bóveda estándar
    vault = {200: 10, 100: 10, 50: 10, 20: 20, 10: 20, 5: 20, 1: 50}
    
    # Monto Q123: 1x100 + 1x20 + 3x1 = 123
    disp_123 = BankingService.calculate_optimal_dispense(123, vault)
    assert disp_123 is not None
    total_123 = sum(int(d) * c for d, c in disp_123.items())
    assert total_123 == 123
    assert disp_123.get("100") == 1
    assert disp_123.get("20") == 1
    assert disp_123.get("1") == 3

    # Monto Q239: 1x200 + 1x20 + 1x10 + 1x5 + 4x1 = 239
    disp_239 = BankingService.calculate_optimal_dispense(239, vault)
    assert disp_239 is not None
    total_239 = sum(int(d) * c for d, c in disp_239.items())
    assert total_239 == 239

    # Caso borde: Sin billetes de Q1, monto impar imposible Q123 -> debe retornar None
    vault_sin_unos = {200: 10, 100: 10, 50: 10, 20: 20, 10: 20, 5: 20, 1: 0}
    disp_fail = BankingService.calculate_optimal_dispense(123, vault_sin_unos)
    assert disp_fail is None

def test_calculate_breakdown_endpoint():
    """Valida el endpoint /api/user/calculate-breakdown."""
    tok = generate_totp_token()
    login_res = client.post("/api/auth/login", json={
        "card_number": "1234567812345678",
        "pin": "1234",
        "token": tok,
        "is_admin": False
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/user/calculate-breakdown", headers=headers, json={"amount": 123.0})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "FEASIBLE"
    assert data["amount"] == 123.0
    assert "100" in data["breakdown"]

def test_serial_frame_checksum_validation():
    """Valida el algoritmo XOR Checksum para mitigar inyecciones seriales y Hardware Spoofing."""
    payload = '{"status":"SUCCESS","dispensed":123}'
    correct_chk = calculate_checksum(payload)
    valid_frame = f"{payload}*{correct_chk}"
    
    parsed = verify_and_parse_frame(valid_frame)
    assert parsed["status"] == "SUCCESS"
    assert parsed["dispensed"] == 123

    # Trama manipulada / checksum inválido
    spoofed_frame = f"{payload}*FF"
    parsed_spoofed = verify_and_parse_frame(spoofed_frame)
    assert parsed_spoofed["status"] == "ERROR"
    assert parsed_spoofed["code"] == "HARDWARE_SPOOFING_DETECTED"

    # Trama corrupta
    corrupt = verify_and_parse_frame("MALFORMED_GARBAGE")
    assert corrupt["status"] == "ERROR"

def test_flat_file_sanitization_defense():
    """Valida que entradas maliciosas con '|' o saltos de línea se escapen previniendo delimiter injection."""
    malicious_name = "Carlos | HACKED_INJECTION | 999999.00\nInjectedLine"
    sanitized = sanitize_flat_field(malicious_name)
    assert "|" not in sanitized
    assert "\n" not in sanitized
    assert "\r" not in sanitized
    assert "/" in sanitized

def test_forensic_soft_delete_txt_audit():
    """Valida la generación del archivo plano forense auditoria_eliminaciones.txt con snapshot JSON."""
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

    unique_card = f"88{int(time.time() * 1000) % 100000000000000:014d}"
    reg_res = client.post("/api/admin/users/register", headers=admin_headers, json={
        "nombre_completo": "Empleado Auditoria Forense",
        "numero_tarjeta": unique_card,
        "pin": "1234",
        "saldo_inicial": 750.0,
        "monto_max_diario": 1000.0
    })
    assert reg_res.status_code == 200
    user_id = reg_res.json()["id_usuario"]

    # Soft-delete con motivo específico
    motivo = "Auditoria de cumplimiento regulatorio"
    del_res = client.post("/api/admin/users/soft-delete", headers=admin_headers, json={
        "id_usuario": user_id,
        "motivo": motivo
    })
    assert del_res.status_code == 200

    # Comprobar que auditoria_eliminaciones.txt contiene el registro
    audit_file = os.path.join("data", "storage_txt", "auditoria_eliminaciones.txt")
    assert os.path.exists(audit_file)
    with open(audit_file, "r", encoding="utf-8") as f:
        content = f.read()
    assert str(user_id) in content
    assert motivo in content

def test_multiagent_swarm_health():
    """Valida la operatividad del enjambre multiagente Graphify a través de /health/swarm."""
    res = client.get("/health/swarm")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "OPERATIONAL"
    agents = data["agents"]
    assert "Agent-Sentinel" in agents
    assert "Agent-Ledger" in agents
    assert "Agent-Diagnostics" in agents
    assert "Agent-Context" in agents
    assert agents["Agent-Context"]["clean_architecture"] is True
