#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "==================================================================="
echo "  LANZADOR DOCKER - SISTEMA CAJERO AUTOMÁTICO (LINUX)"
echo "==================================================================="
echo ""

# 1. Validar instalación de Docker
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker no está instalado en este sistema Linux."
    echo "Para instalar Docker en Debian/Ubuntu ejecute:"
    echo "  sudo apt update && sudo apt install -y docker.io docker-compose-plugin"
    echo "  sudo usermod -aG docker \$USER"
    exit 1
fi

# 2. Levantar el stack mediante docker compose
echo "[1/3] Compilando y levantando contenedores con docker compose..."
docker compose up -d --build

echo "[2/3] Esperando inicialización del backend y base de datos (10 segundos)..."
sleep 10

# 3. Lanzar interfaz en modo kiosco o navegador
echo "[3/3] Abriendo terminal Kiosco en http://localhost:5173..."
if command -v chromium &> /dev/null; then
    chromium --kiosk --noerrdialogs --disable-infobars http://localhost:5173 &
elif command -v google-chrome &> /dev/null; then
    google-chrome --kiosk http://localhost:5173 &
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5173
else
    echo "Kiosco disponible en su navegador: http://localhost:5173"
fi

echo ""
echo "==================================================================="
echo "  SISTEMA DE CAJERO EN EJECUCIÓN VÍA DOCKER"
echo "  - Frontend Kiosk:  http://localhost:5173"
echo "  - Backend Core:    http://localhost:8000"
echo "  - Swagger Docs:    http://localhost:8000/docs"
echo "  Para detener los contenedores ejecute en esta carpeta:"
echo "    docker compose down"
echo "==================================================================="
