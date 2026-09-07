import os
import pytest

STORAGE_DIR = "data/storage_txt"

def test_storage_files_exist():
    expected_files = [
        "usuarios.txt",
        "cajero_inventario.txt",
        "transacciones_historico.txt",
        "auditoria_eventos.txt"
    ]
    for fn in expected_files:
        path = os.path.join(STORAGE_DIR, fn)
        assert os.path.exists(path), f"El archivo {fn} no existe en {STORAGE_DIR}"

def test_usuarios_txt_format():
    path = os.path.join(STORAGE_DIR, "usuarios.txt")
    with open(path, "r", encoding="utf-8") as f:
        lines = [l.strip() for l in f if l.strip()]
    assert len(lines) >= 6 # 1 admin + 5 employees
    for line in lines:
        parts = line.split("|")
        assert len(parts) == 9, f"Línea de usuario inválida: {line}"
        # ID_USUARIO | NOMBRE | TARJETA | PIN_HASH | SALDO | MONTO_MAX | RETIRADO_HOY | CAMBIO_PIN | ULTIMO_ACCESO
        assert parts[0].isdigit()
        assert len(parts[2]) == 16
        assert float(parts[4]) >= 0.0

def test_cajero_inventario_txt_format():
    path = os.path.join(STORAGE_DIR, "cajero_inventario.txt")
    with open(path, "r", encoding="utf-8") as f:
        lines = [l.strip() for l in f if l.strip()]
    # Line 1: TOTAL_BOVEDA|total
    assert len(lines) >= 8
    first_parts = lines[0].split("|")
    assert first_parts[0] == "TOTAL_BOVEDA"
    total_reported = float(first_parts[1])
    assert total_reported <= 30000.00

    sum_subtotals = 0.0
    for line in lines[1:]:
        parts = line.split("|")
        assert len(parts) == 3 # DENOM | CANTIDAD | SUBTOTAL
        sum_subtotals += float(parts[2])
    assert round(sum_subtotals, 2) == round(total_reported, 2)

def test_transacciones_txt_format():
    path = os.path.join(STORAGE_DIR, "transacciones_historico.txt")
    with open(path, "r", encoding="utf-8") as f:
        lines = [l.strip() for l in f if l.strip()]
    assert len(lines) > 0
    for line in lines:
        parts = line.split("|")
        assert len(parts) == 6 # ID_TX | TIMESTAMP | ID_USUARIO | TIPO | MONTO | DESGLOSE_JSON
        assert parts[3] in ["RETIRO", "DEPOSITO"]
        assert float(parts[4]) > 0.0

def test_auditoria_txt_format():
    path = os.path.join(STORAGE_DIR, "auditoria_eventos.txt")
    with open(path, "r", encoding="utf-8") as f:
        lines = [l.strip() for l in f if l.strip()]
    assert len(lines) > 0
    for line in lines:
        parts = line.split("|")
        assert len(parts) == 5 # ID_LOG | TIMESTAMP | ID_USUARIO | ACCION | DETALLES

def test_auditoria_eliminaciones_txt_format():
    """Valida el formato estricto del log forense de Soft Delete: timestamp|registro_id|operador_id|motivo_baja|snapshot_anterior_json."""
    path = os.path.join(STORAGE_DIR, "auditoria_eliminaciones.txt")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f if l.strip()]
        for line in lines:
            parts = line.split("|")
            assert len(parts) >= 5, f"Línea de auditoria_eliminaciones inválida: {line}"
            # parts[0]: timestamp, parts[1]: registro_id, parts[2]: operador_id, parts[3]: motivo, parts[4]: snapshot_json
            assert parts[1].isdigit()
            assert parts[2].isdigit() or parts[2] == "ADMIN"

if __name__ == "__main__":
    test_storage_files_exist()
    test_usuarios_txt_format()
    test_cajero_inventario_txt_format()
    test_transacciones_txt_format()
    test_auditoria_txt_format()
    print("All dual-write persistence tests passed successfully!")