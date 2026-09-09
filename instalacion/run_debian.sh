#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "==================================================================="
echo "  EJECUTOR NATIVO PARA DEBIAN GNU/LINUX (SISTEMA DE CAJERO)"
echo "==================================================================="
echo ""

if [ -d "venv" ]; then
    source venv/bin/activate
fi

# 1. Arrancar Backend en segundo plano
echo "[1/2] Arrancando Backend Core API en http://127.0.0.1:8000..."
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

trap "kill $BACKEND_PID 2>/dev/null || true" EXIT

sleep 3

# 2. Verificar y compilar Frontend si no existe el bundle de producción
if [ ! -f "frontend/dist/index.html" ]; then
    echo "[!] Compilación de frontend no detectada. Compilando bundle de producción..."
    if [ ! -d "frontend/node_modules" ]; then
        (cd frontend && npm install --include=dev)
    fi
    (cd frontend && npm run build)
fi

# 3. Iniciar Terminal Kiosco
echo "[2/2] Lanzando terminal de Kiosco táctil..."
if [ -f "frontend/node_modules/.bin/electron" ]; then
    cd frontend && npm run electron
elif command -v chromium &> /dev/null; then
    python3 -m http.server 5173 --directory frontend/dist &
    STATIC_PID=$!
    trap "kill $BACKEND_PID $STATIC_PID 2>/dev/null || true" EXIT
    sleep 1
    chromium --kiosk http://localhost:5173
elif command -v google-chrome &> /dev/null; then
    python3 -m http.server 5173 --directory frontend/dist &
    STATIC_PID=$!
    trap "kill $BACKEND_PID $STATIC_PID 2>/dev/null || true" EXIT
    sleep 1
    google-chrome --kiosk http://localhost:5173
else
    python3 -m http.server 5173 --directory frontend/dist &
    STATIC_PID=$!
    trap "kill $BACKEND_PID $STATIC_PID 2>/dev/null || true" EXIT
    echo "Abra en su navegador: http://localhost:5173"
    wait $BACKEND_PID
fi
