import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()

try:
    from backend.app.core.config import settings
    DB_USER = settings.DB_USER
    DB_PASSWORD = settings.DB_PASSWORD
    DB_HOST = settings.DB_HOST
    DB_PORT = settings.DB_PORT
    DB_NAME = settings.DB_NAME
except Exception:
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "admin123")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "atm_system")

mysql_url = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
sqlite_path = os.path.join(os.path.dirname(__file__), "atm_system.db")
sqlite_url = f"sqlite:///{sqlite_path}"

try:
    engine = create_engine(mysql_url, pool_recycle=3600, pool_pre_ping=True)
    with engine.connect() as conn:
        print("[DATABASE] Conexión establecida exitosamente con MySQL 8.4 InnoDB.")
except Exception as e:
    print(f"[DATABASE] MySQL no disponible ({e}). Conectando a SQLite de respaldo: {sqlite_path}")
    engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
