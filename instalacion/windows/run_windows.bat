@echo off
title Lanzador Completo Sistema Bancario Cajero ATM
cd /d "%~dp0\..\.."
echo ===================================================================
echo   LANZANDO SISTEMA COMPLETO CAJERO AUTOMATICO (WINDOWS)
echo   1. Servidor Backend Python FastAPI (Puerto 8000)
echo   2. Interfaz Kiosco Electron (Ventana y Pantalla Completa)
echo ===================================================================
echo.

if not exist "frontend\dist\index.html" (
    echo [!] frontend\dist no encontrado. Compilando aplicacion web...
    cd frontend
    call npm install --include=dev
    call npm run build
    cd ..
)

echo Iniciando Backend FastAPI en segundo plano...
start "Backend FastAPI (Puerto 8000)" cmd /c "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"

echo Esperando inicializacion de API (3 segundos)...
timeout /t 3 /nobreak > nul

echo Iniciando Terminal de Kiosco Electron...
start "Kiosco Electron" cmd /c "cd frontend && npm run start"

echo.
echo ===================================================================
echo   Sistema ejecutandose en paralelo con exito.
echo   - Frontend: Ventana Kiosco Electron
echo   - Backend:  http://127.0.0.1:8000 (Swagger: /docs)
echo   - Atajos:   F11 (Pantalla Completa), Esc (Modo Ventana)
echo ===================================================================
pause
