#!/usr/bin/env bash
# ===================================================================
# SISTEMA DE CAJERO AUTOMATICO BANCARIO - MODO SERVIDOR WEB
# Script dedicado para ejecutar FastAPI + Frontend Web en Linux
# ===================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PORT=5173

echo -e "\e[1;36m===================================================================\e[0m"
echo -e "\e[1;33m   SISTEMA DE CAJERO AUTOMATICO BANCARIO - MODO SERVIDOR WEB       \e[0m"
echo -e "\e[1;36m===================================================================\e[0m"
echo ""

# Verificar dependencias
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Verificar build de frontend
if [ ! -f "frontend/dist/index.html" ]; then
    echo -e "\e[1;33m[*] frontend/dist no encontrado. Compilando aplicación...\e[0m"
    cd frontend
    if [ ! -d "node_modules" ]; then
        npm install --include=dev
    fi
    npm run build
    cd "$PROJECT_ROOT"
fi

cleanup() {
    echo ""
    echo -e "\e[1;31m[*] Deteniendo servicios web del cajero...\e[0m"
    kill 0
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo -e "\e[1;32m[1/2] Iniciando Backend FastAPI en http://0.0.0.0:8000...\e[0m"
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

sleep 2

echo -e "\e[1;32m[2/2] Iniciando Servidor Web Frontend en http://localhost:$PORT...\e[0m"
python3 -m http.server $PORT --directory frontend/dist &
WEB_PID=$!

sleep 1

# Intentar abrir el navegador en Linux
if command -v xdg-open > /dev/null; then
    xdg-open "http://localhost:$PORT" > /dev/null 2>&1 &
elif command -v sensible-browser > /dev/null; then
    sensible-browser "http://localhost:$PORT" > /dev/null 2>&1 &
fi

echo ""
echo -e "\e[1;36m===================================================================\e[0m"
echo -e "\e[1;32m   SERVIDOR WEB EN EJECUCION                                      \e[0m"
echo -e "\e[1;37m   - Frontend Web:  http://localhost:$PORT                         \e[0m"
echo -e "\e[1;33m   - Backend API:   http://127.0.0.1:8000 (Swagger: /docs)         \e[0m"
echo -e "\e[1;36m===================================================================\e[0m"
echo "Presione Ctrl+C para detener todos los servicios."

wait
