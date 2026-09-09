#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

echo "==================================================================="
echo "  INSTALADOR NATIVO PARA LINUX (DEBIAN / UBUNTU / LINUX MINT)"
echo "  Sistema de Cajero Automático Bancario Embebido"
echo "==================================================================="
echo ""

echo "[1/4] Actualizando repositorios APT e instalando paquetes del sistema..."
sudo apt update
sudo apt install -y python3 python3-pip python3-venv nodejs npm chromium curl libmysqlclient-dev pkg-config gcc

echo ""
echo "[2/4] Configurando entorno virtual de Python..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip

if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
elif [ -f "backend/requirements.txt" ]; then
    pip install -r backend/requirements.txt
else
    echo "ERROR: No se encontró requirements.txt en la raíz ni en backend/"
    exit 1
fi

chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
chmod +x instalacion/*.sh 2>/dev/null || true

echo ""
echo "[3/4] Inicializando base de datos local y tablas..."
python database/init_db.py

echo ""
echo "[4/4] Instalando dependencias de Node.js y compilando Frontend..."
cd frontend
npm install --include=dev
npm run build
if [ ! -f "dist/index.html" ]; then
    echo "ERROR: Falló la compilación de frontend/dist/index.html"
    exit 1
fi
cd ..

echo ""
echo "==================================================================="
echo "  INSTALACIÓN COMPLETADA CON ÉXITO EN LINUX"
echo "  Para iniciar el cajero ejecute:"
echo "    ./instalacion/linux/run_linux.sh"
echo "  O haga doble clic sobre Cajero.desktop"
echo "==================================================================="
