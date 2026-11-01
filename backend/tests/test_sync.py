import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_sync_status_endpoint():
    """Verifica que el endpoint de estado de sincronización tripartita devuelva SQLite, MySQL y Cloud."""
    res = client.get("/api/sync/status")
    assert res.status_code == 200
    data = res.json()
    assert "sqlite" in data
    assert "mysql" in data
    assert "cloud" in data
    assert data["sqlite"]["status"] in ["connected", "synced"]
    assert data["sqlite"]["name"] == "SQLite Local"
    assert "badge" in data["sqlite"]
    assert "badge" in data["mysql"]
    assert "badge" in data["cloud"]

def test_sync_export_and_import():
    """Verifica la exportación e importación relacional completa."""
    # 1. Export
    exp_res = client.get("/api/sync/export")
    assert exp_res.status_code == 200
    snapshot = exp_res.json()
    assert "data" in snapshot
    assert "cajeros" in snapshot["data"]
    assert "usuarios" in snapshot["data"]
    assert any(c["id_cajero"] == "ATM-004" for c in snapshot["data"]["cajeros"])

    # 2. Import snapshot
    imp_res = client.post("/api/sync/import", json=snapshot)
    assert imp_res.status_code == 200
    imp_data = imp_res.json()
    assert imp_data["success"] is True

def test_sync_execute_endpoint():
    """Verifica la ejecución de la sincronización sin errores."""
    res = client.post("/api/sync/execute")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "statuses" in data
    assert data["statuses"]["sqlite"] == "synced"
