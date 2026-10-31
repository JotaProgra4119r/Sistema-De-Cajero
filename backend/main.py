import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.db.init_db import init_db
from backend.app.db.database import SessionLocal
from backend.app.storage_txt.txt_manager import txt_manager
from backend.app.hardware.serial_controller import serial_controller
from backend.app.api.ws import ws_manager
from backend.app.api import auth, user, admin, hardware, ws, interbank
from backend.app.services.interbank_service import interbank_manager
from agents import swarm_manager, event_bus

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("==================================================")
    print("   INICIANDO BACKEND SISTEMA BANCARIO CAJERO ATM  ")
    print("==================================================")
    init_db()
    
    # Sync txt files from DB on startup
    db = SessionLocal()
    try:
        await txt_manager.sync_all_from_db(db)
        print("[STORAGE] Persistencia dual sincronizada en ./database/storage_txt/ y ./data/storage_txt/")
    finally:
        db.close()

    # Wire multiagent swarm
    print("[MULTIAGENT] Enjambre Graphify inicializado: Sentinel, Ledger, Diagnostics, Context.")

    # Hook hardware events into WebSocket broadcast and Multiagent EventBus
    def on_hardware_event(evt):
        asyncio.create_task(ws_manager.broadcast(evt))
        asyncio.create_task(event_bus.publish("hardware.event", evt))
    serial_controller.register_callback(on_hardware_event)

    # Iniciar servidores del protocolo interbancario de red (TCP 5000 / UDP 5005)
    try:
        await interbank_manager.start()
        print(f"[INTERBANK] Red Interbancaria en línea: TCP {settings.INTERBANK_TCP_PORT} / UDP {settings.INTERBANK_UDP_PORT}")
    except Exception as e:
        print(f"[INTERBANK WARNING] No se pudo iniciar el protocolo interbancario: {e}")

    yield
    print("[BACKEND] Apagando servicios bancarios.")
    try:
        await interbank_manager.stop()
    except Exception:
        pass

app = FastAPI(
    title="Sistema Bancario y Cajero Automático Embebido API",
    description="API Gateway y Motor Transaccional para Kiosco ATM y Hardware Embebido (Arduino/ESP32)",
    version="1.0.2",
    lifespan=lifespan
)

# CORS configuration for multi-device / LAN / mini-production deployment
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(admin.router)
app.include_router(hardware.router)
app.include_router(ws.router)
app.include_router(interbank.router)

@app.get("/health")
def health_check():
    return {
        "status": "ONLINE",
        "service": "ATM_CORE_GATEWAY",
        "mock_hardware": serial_controller.mock_mode
    }

@app.get("/health/swarm")
def swarm_health():
    return swarm_manager.get_swarm_health()

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    from fastapi import Response
    return Response(status_code=204)

# =========================================================================
# MONTAJE Y SERVIDO DEL FRONTEND COMPILADO (PRODUCCIÓN CLOUD / RENDER / WEB)
# =========================================================================
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")

if os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Si la ruta es de la API o docs, dejar que FastAPI maneje el 404 o su ruta
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json") or full_path.startswith("ws"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Endpoint no encontrado.")
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
else:
    @app.get("/")
    def root():
        return {
            "name": "ATM Banking System Core API",
            "version": "1.0.2",
            "docs": "/docs",
            "health": "/health",
            "nota": "Para acceder a la interfaz web, compile el frontend con: cd frontend && npm run build"
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", settings.API_PORT))
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )

