import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.core.config import settings

# Construct MySQL URL safely
mysql_url = f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}?charset=utf8mb4"
sqlite_url = "sqlite:///./data/atm_system.db"

engine = None
USE_SQLITE = False

try:
    test_engine = create_engine(mysql_url, connect_args={"connect_timeout": 2}, pool_pre_ping=True)
    with test_engine.connect() as conn:
        pass
    engine = test_engine
    print("[DATABASE] Conectado exitosamente a MySQL Server.")
except Exception as ex:
    print(f"[DATABASE] MySQL no disponible o no configurado ({ex}). Conectando a SQLite de respaldo.")
    os.makedirs("./data", exist_ok=True)
    engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    USE_SQLITE = True

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()