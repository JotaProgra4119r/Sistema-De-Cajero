#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==================================================================="
echo "  LANZADOR DOCKER - SISTEMA CAJERO AUTOMÁTICO BANCARIO (DEBIAN/LINUX)"
echo "==================================================================="
echo ""

# 1. Validar instalación de Docker
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker no está instalado en este sistema Debian."
    echo "Para instalar Docker en Debian ejecute:"
    echo "  sudo apt update && sudo apt install -y docker.io docker-compose-plugin"
    echo "  sudo usermod -aG docker \$USER"
    exit 1
fi

# 2. Levantar el stack mediante docker compose
echo "[1/3] Compilando y levantando contenedores con docker compose..."
docker compose up -d --build

echo "[2/3] Esperando inicialización del backend y base de datos..."
sleep 8

# 3. Lanzar interfaz en modo kiosco o navegador
echo "[3/3] Abriendo terminal Kiosco..."
if command -v chromium &> /dev/null; then
    chromium --kiosk --noerrdialogs --disable-infobars --check-for-update-interval=31536000 http://localhost:5173 &
elif command -v google-chrome &> /dev/null; then
    google-chrome --kiosk http://localhost:5173 &
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5173
else
    echo "Kiosco disponible en: http://localhost:5173"
fi

echo ""
echo "==================================================================="
echo "  SISTEMA OPERATIVO EN EJECUCIÓN VIA DOCKER"
echo "  - Frontend Kiosk:  http://localhost:5173"
echo "  - Backend Core:    http://localhost:8000"
echo "  - Swagger API:     http://localhost:8000/docs"
echo "  Para detener: docker compose down"
echo "==================================================================="
