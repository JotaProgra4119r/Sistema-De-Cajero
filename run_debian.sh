#!/usr/bin/env bash
set -e

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

# Asegurar que al salir se detenga el backend
trap "kill $BACKEND_PID 2>/dev/null || true" EXIT

sleep 3

# 2. Iniciar Terminal Kiosco
echo "[2/2] Lanzando terminal de Kiosco táctil..."
if [ -f "frontend/node_modules/.bin/electron" ]; then
    cd frontend && npm run electron
elif command -v chromium &> /dev/null; then
    chromium --kiosk http://localhost:5173
elif command -v google-chrome &> /dev/null; then
    google-chrome --kiosk http://localhost:5173
else
    echo "Abra en su navegador: http://localhost:5173"
    wait $BACKEND_PID
fi
