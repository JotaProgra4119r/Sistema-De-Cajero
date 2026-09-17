import os
import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()

# Cargar automáticamente variables de entorno desde .env si existe
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(env_path):
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k not in os.environ:
                        os.environ[k] = v
    except Exception:
        pass

DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "atm_system")

# Escapar caracteres especiales en la contraseña (por ejemplo @, #, etc.) para la URL de SQLAlchemy
safe_password = urllib.parse.quote_plus(DB_PASSWORD)
mysql_url = f"mysql+pymysql://{DB_USER}:{safe_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
sqlite_path = os.path.join(os.path.dirname(__file__), "atm_system.db")
sqlite_url = f"sqlite:///{sqlite_path}"

try:
    engine = create_engine(mysql_url, pool_recycle=3600, pool_pre_ping=True)
    with engine.connect() as conn:
        print("[DATABASE] Conexión establecida exitosamente con MySQL 8.0 / 8.4 InnoDB.")
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
