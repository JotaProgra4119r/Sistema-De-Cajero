#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

echo "==================================================================="
echo "  EJECUTOR NATIVO PARA LINUX (DEBIAN / UBUNTU / LINUX MINT)"
echo "  Sistema de Cajero Automático Bancario Embebido"
echo "==================================================================="
echo ""

# Activar entorno virtual
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# 1. Arrancar Backend en segundo plano
echo "[1/3] Arrancando Backend Core API en http://127.0.0.1:8000..."
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

trap "kill $BACKEND_PID 2>/dev/null || true" EXIT
sleep 3

# 2. Verificar y compilar Frontend si no existe el bundle de producción
echo "[2/3] Verificando paquete de distribución web..."
if [ ! -f "frontend/dist/index.html" ]; then
    echo "[!] Compilación de frontend no detectada. Compilando bundle de producción..."
    if [ ! -d "frontend/node_modules" ]; then
        (cd frontend && npm install --include=dev)
    fi
    (cd frontend && npm run build)
fi

# 3. Iniciar Terminal Kiosco
echo "[3/3] Lanzando terminal de Kiosco táctil..."
if [ -f "frontend/node_modules/.bin/electron" ]; then
    cd frontend && npm run electron
elif command -v chromium &> /dev/null; then
    python3 -m http.server 5173 --directory frontend/dist &
    STATIC_PID=$!
    trap "kill $BACKEND_PID $STATIC_PID 2>/dev/null || true" EXIT
    sleep 1
    chromium --kiosk --noerrdialogs --disable-infobars http://localhost:5173
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
    echo ""
    echo "==================================================================="
    echo "  Kiosco web en ejecucion. Abra en su navegador:"
    echo "  -> http://localhost:5173"
    echo "==================================================================="
    wait $BACKEND_PID
fi
