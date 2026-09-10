#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

WEB_MODE=false
PORT="${PORT:-5173}"

for arg in "$@"; do
    case $arg in
        --web|-w|--server)
            WEB_MODE=true
            shift
            ;;
        --port=*)
            PORT="${arg#*=}"
            shift
            ;;
    esac
done

echo "==================================================================="
echo "  EJECUTOR MULTIPLATAFORMA LINUX (DEBIAN / UBUNTU / LINUX MINT)"
echo "  Sistema de Cajero Automático Bancario Embebido"
echo "==================================================================="
echo ""

if [ "$WEB_MODE" = false ]; then
    echo "[*] Iniciando Modo Kiosco Electron (predeterminado)..."
    echo "    (Para ejecutar en modo web en el navegador, use ./run_web.sh o --web)"
    echo ""
fi

# Activar entorno virtual
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# 1. Arrancar Backend en segundo plano
echo "[1/2] Arrancando Backend Core API en http://0.0.0.0:8000..."
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

trap "kill $BACKEND_PID 2>/dev/null || true" EXIT
sleep 2

# 2. Verificar y compilar Frontend si no existe el bundle de producción
echo "[2/2] Verificando paquete de distribución web..."
if [ ! -f "frontend/dist/index.html" ]; then
    echo "[!] Compilación de frontend no detectada. Compilando bundle de producción..."
    if [ ! -d "frontend/node_modules" ]; then
        (cd frontend && npm install --include=dev)
    fi
    (cd frontend && npm run build)
fi

# 3. Iniciar según el modo seleccionado
if [ "$WEB_MODE" = true ]; then
    python3 -m http.server "$PORT" --directory frontend/dist &
    STATIC_PID=$!
    trap "kill $BACKEND_PID $STATIC_PID 2>/dev/null || true" EXIT

    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
    echo ""
    echo "==================================================================="
    echo "  MODO SERVIDOR WEB ACTIVO (SISTEMA DE CAJERO)"
    echo "  - URL Local (Host):     http://localhost:$PORT"
    echo "  - URL Red Local (LAN):  http://$LOCAL_IP:$PORT"
    echo "  - Backend Swagger Docs: http://localhost:8000/docs"
    echo ""
    echo "  Listo para abrir desde cualquier navegador web en la red."
    echo "  Presione Ctrl+C para detener el servicio."
    echo "==================================================================="

    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:$PORT" 2>/dev/null || true
    fi

    wait $BACKEND_PID
else
    echo "Lanzando terminal de Kiosco táctil (Electron)..."
    if [ -f "frontend/node_modules/.bin/electron" ]; then
        cd frontend && npm run electron
    elif command -v chromium &> /dev/null; then
        python3 -m http.server "$PORT" --directory frontend/dist &
        STATIC_PID=$!
        trap "kill $BACKEND_PID $STATIC_PID 2>/dev/null || true" EXIT
        sleep 1
        chromium --kiosk --noerrdialogs --disable-infobars "http://localhost:$PORT"
    elif command -v google-chrome &> /dev/null; then
        python3 -m http.server "$PORT" --directory frontend/dist &
        STATIC_PID=$!
        trap "kill $BACKEND_PID $STATIC_PID 2>/dev/null || true" EXIT
        sleep 1
        google-chrome --kiosk "http://localhost:$PORT"
    else
        python3 -m http.server "$PORT" --directory frontend/dist &
        STATIC_PID=$!
        trap "kill $BACKEND_PID $STATIC_PID 2>/dev/null || true" EXIT
        echo ""
        echo "==================================================================="
        echo "  Kiosco web en ejecución. Abra en su navegador:"
        echo "  -> http://localhost:$PORT"
        echo "==================================================================="
        wait $BACKEND_PID
    fi
fi
