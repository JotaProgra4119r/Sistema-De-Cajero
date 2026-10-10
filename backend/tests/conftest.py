import sys
from pathlib import Path
import pytest

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from database.init_db import init_db
from database.connection import Base, engine

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Garantiza que el esquema de la base de datos (tablas, roles, administrador y usuarios)
    esté completamente inicializado antes de ejecutar cualquier suite de pruebas en CI/CD o local.
    """
    Base.metadata.create_all(bind=engine)
    init_db()
    yield
