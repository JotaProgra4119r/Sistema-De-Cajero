@echo off
title Instalador Sistema Bancario Cajero ATM (Windows)
cd /d "%~dp0\..\.."
echo ===================================================================
echo   INSTALACION DE DEPENDENCIAS (WINDOWS 10 / 11)
echo   Sistema de Cajero Automatico Bancario Embebido
echo ===================================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python no esta instalado o no se encuentra en el PATH.
    echo Por favor instale Python 3.10 o superior marcando "Add Python to PATH".
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js / NPM no esta instalado o no se encuentra en el PATH.
    echo Por favor instale Node.js (v18+) desde https://nodejs.org/
    pause
    exit /b 1
)

echo [1/3] Instalando dependencias de Python...
if exist "requirements.txt" (
    pip install -r requirements.txt
) else if exist "backend\requirements.txt" (
    pip install -r backend\requirements.txt
)

echo.
echo [2/3] Inicializando base de datos local y tablas...
python database\init_db.py

echo.
echo [3/3] Instalando dependencias de Node.js y compilando Frontend...
cd frontend
call npm install --include=dev
call npm run build
if not exist "dist\index.html" (
    echo [ERROR] Fallo la compilacion del bundle de produccion frontend\dist\index.html
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ===================================================================
echo   INSTALACION COMPLETADA CON EXITO EN WINDOWS
echo   Para iniciar el cajero ejecute: instalacion\windows\run_windows.bat
echo ===================================================================
pause
