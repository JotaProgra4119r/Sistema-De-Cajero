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

# Variables de Microsoft SQL Server 2022 (sqlserver22)
SQL_SERVER_HOST = os.getenv("SQL_SERVER_HOST", os.getenv("DB_HOST", "127.0.0.1"))
SQL_SERVER_PORT = os.getenv("SQL_SERVER_PORT", "1433")
SQL_SERVER_INSTANCE = os.getenv("SQL_SERVER_INSTANCE", "sqlserver22")
SQL_SERVER_DB = os.getenv("SQL_SERVER_DB", os.getenv("DB_NAME", "atm_system"))
SQL_SERVER_USER = os.getenv("SQL_SERVER_USER", "")
SQL_SERVER_PASSWORD = os.getenv("SQL_SERVER_PASSWORD", "")

# Detección inteligente de motor de base de datos
force_sqlite = os.getenv("USE_SQLITE", "").lower() in ("true", "1", "yes")
use_sqlserver = not force_sqlite and (
    os.getenv("USE_SQLSERVER", "true").lower() in ("true", "1", "yes") or
    bool(os.getenv("MSSQL_URL")) or
    "mssql" in (os.getenv("DATABASE_URL") or "") or
    "sqlserver" in (os.getenv("DATABASE_URL") or "")
)
use_mysql = not force_sqlite and (
    bool(os.getenv("MYSQL_URL")) or
    os.getenv("USE_MYSQL", "false").lower() in ("true", "1", "yes")
)

sqlite_path = os.path.join(os.path.dirname(__file__), "atm_system.db")
sqlite_url = f"sqlite:///{sqlite_path}"

engine = None

if not force_sqlite:
    # 1. Intentar conectar a Microsoft SQL Server 2022 (sqlserver22)
    if use_sqlserver:
        raw_mssql_url = os.getenv("MSSQL_URL") or (os.getenv("DATABASE_URL") if ("mssql" in (os.getenv("DATABASE_URL") or "") or "sqlserver" in (os.getenv("DATABASE_URL") or "")) else None)
        if raw_mssql_url:
            try:
                cand_engine = create_engine(raw_mssql_url, pool_recycle=3600, pool_pre_ping=True)
                with cand_engine.connect() as conn:
                    engine = cand_engine
                    print("[DATABASE] Conexión establecida exitosamente con Microsoft SQL Server 2022 (sqlserver22) vía URL.")
            except Exception:
                engine = None

        if engine is None:
            # Probar candidatos de conexión ODBC en Windows
            candidates = [
                f"Driver={{ODBC Driver 18 for SQL Server}};Server=.\\SQLEXPRESS;Database={SQL_SERVER_DB};Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=2;",
                f"Driver={{ODBC Driver 18 for SQL Server}};Server=.\\{SQL_SERVER_INSTANCE};Database={SQL_SERVER_DB};Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=2;",
                f"Driver={{ODBC Driver 18 for SQL Server}};Server=(local)\\SQLEXPRESS;Database={SQL_SERVER_DB};Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=2;",
                f"Driver={{ODBC Driver 18 for SQL Server}};Server=localhost\\{SQL_SERVER_INSTANCE};Database={SQL_SERVER_DB};Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=2;",
                f"Driver={{ODBC Driver 18 for SQL Server}};Server=localhost\\SQLEXPRESS;Database={SQL_SERVER_DB};Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=2;",
                f"Driver={{ODBC Driver 17 for SQL Server}};Server=.\\SQLEXPRESS;Database={SQL_SERVER_DB};Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=2;",
                f"Driver={{ODBC Driver 17 for SQL Server}};Server=localhost\\{SQL_SERVER_INSTANCE};Database={SQL_SERVER_DB};Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=2;",
                f"Driver={{ODBC Driver 17 for SQL Server}};Server=localhost\\SQLEXPRESS;Database={SQL_SERVER_DB};Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=2;",
                f"Driver={{ODBC Driver 18 for SQL Server}};Server={SQL_SERVER_HOST},{SQL_SERVER_PORT};Database={SQL_SERVER_DB};Uid={SQL_SERVER_USER};Pwd={SQL_SERVER_PASSWORD};TrustServerCertificate=yes;Connection Timeout=2;",
                f"Driver={{ODBC Driver 17 for SQL Server}};Server={SQL_SERVER_HOST},{SQL_SERVER_PORT};Database={SQL_SERVER_DB};Uid={SQL_SERVER_USER};Pwd={SQL_SERVER_PASSWORD};TrustServerCertificate=yes;Connection Timeout=2;",
            ]
            for conn_str in candidates:
                try:
                    params = urllib.parse.quote_plus(conn_str)
                    cand_engine = create_engine(f"mssql+pyodbc:///?odbc_connect={params}", pool_recycle=3600, pool_pre_ping=True)
                    with cand_engine.connect() as conn:
                        engine = cand_engine
                        print(f"[DATABASE] Conexión establecida exitosamente con Microsoft SQL Server 2022 (sqlserver22) [{SQL_SERVER_DB}].")
                        break
                except Exception:
                    continue

    # 2. Si SQL Server no está disponible, intentar con MySQL si está habilitado
    if engine is None and use_mysql:
        try:
            raw_db_url = os.getenv("MYSQL_URL") or (os.getenv("DATABASE_URL") if "mysql" in (os.getenv("DATABASE_URL") or "") else None)
            if not raw_db_url:
                safe_password = urllib.parse.quote_plus(DB_PASSWORD)
                raw_db_url = f"mysql+pymysql://{DB_USER}:{safe_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
            cand_engine = create_engine(raw_db_url, pool_recycle=3600, pool_pre_ping=True)
            with cand_engine.connect() as conn:
                engine = cand_engine
                print(f"[DATABASE] Conexión establecida exitosamente con motor MySQL en {DB_HOST}:{DB_PORT} ({DB_NAME}).")
        except Exception:
            engine = None

# 3. Fallback transparente a SQLite local
if engine is None:
    print(f"[DATABASE] Motores relacionales remotos no accesibles. Usando SQLite de respaldo: {sqlite_path}")
    engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
