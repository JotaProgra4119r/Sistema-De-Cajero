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
                    parts = line.split("=", 1)
                    k = parts[0].strip()
                    v = parts[1].strip().strip("'\"")
                    if k and k.isidentifier():
                        if k not in os.environ:
                            os.environ[k] = v
    except Exception:
        pass

DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "atm_system")

# Detección inteligente de motor de base de datos
force_sqlite = os.getenv("USE_SQLITE", "").lower() in ("true", "1", "yes")
use_mysql = not force_sqlite and (
    bool(os.getenv("DATABASE_URL") or os.getenv("MYSQL_URL")) or
    os.getenv("USE_MYSQL", "true").lower() in ("true", "1", "yes") or
    bool(os.getenv("DB_HOST"))
)

sqlite_path = os.path.join(os.path.dirname(__file__), "atm_system.db")
sqlite_url = f"sqlite:///{sqlite_path}"

if use_mysql:
    try:
        raw_db_url = os.getenv("DATABASE_URL") or os.getenv("MYSQL_URL")
        if not raw_db_url:
            safe_password = urllib.parse.quote_plus(DB_PASSWORD)
            raw_db_url = f"mysql+pymysql://{DB_USER}:{safe_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        engine = create_engine(raw_db_url, pool_recycle=3600, pool_pre_ping=True)
        with engine.connect() as conn:
            print(f"[DATABASE] Conexión establecida exitosamente con motor MySQL en {DB_HOST}:{DB_PORT} ({DB_NAME}).")
    except Exception as e:
        err_msg = e.args[1] if (hasattr(e, "args") and len(e.args) > 1) else (e.args[0] if e.args else str(e))
        print(f"[DATABASE] MySQL no disponible o credenciales no válidas ({err_msg}). Usando SQLite de respaldo: {sqlite_path}")
        engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
else:
    # Entorno local/Render con almacenamiento autónomo SQLite
    print(f"[DATABASE] Modo autónomo activo. Conectando a SQLite de respaldo: {sqlite_path}")
    engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
