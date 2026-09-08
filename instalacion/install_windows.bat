@echo off
title Instalador Sistema Bancario Cajero ATM (Windows)
cd /d "%~dp0\.."
echo ===================================================================
echo   INSTALACION DE DEPENDENCIAS (WINDOWS)
echo ===================================================================
echo.

echo [1/3] Instalando librerias de Python...
pip install -r requirements.txt

echo [2/3] Inicializando base de datos local y tablas...
python database/init_db.py

echo [3/3] Instalando dependencias de Node.js y compilando Frontend...
cd frontend
call npm install
call npm run build
cd ..

echo.
echo ===================================================================
echo   INSTALACION EXITOSA EN WINDOWS
echo   Para iniciar el cajero ejecute: instalacion\run_windows.bat
echo ===================================================================
pause
