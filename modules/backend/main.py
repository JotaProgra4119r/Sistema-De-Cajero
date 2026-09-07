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
from backend.app.api import auth, user, admin, hardware, ws
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

    yield
    print("[BACKEND] Apagando servicios bancarios.")

app = FastAPI(
    title="Sistema Bancario y Cajero Automático Embebido API",
    description="API Gateway y Motor Transaccional para Kiosco ATM y Hardware Embebido (Arduino/ESP32)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration restricted to authorized origins (prevents CSRF & Unauthorized Browser Injection)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(admin.router)
app.include_router(hardware.router)
app.include_router(ws.router)

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

@app.get("/")
def root():
    return {
        "name": "ATM Banking System Core API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=False
    )
