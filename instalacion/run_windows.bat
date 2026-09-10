@echo off
title Sistema Bancario Cajero ATM (Kiosco Electron)
cd /d "%~dp0\.."

echo ===================================================================
echo   SISTEMA DE CAJERO AUTOMATICO BANCARIO EMBEBIDO (ATM KIOSK)
echo ===================================================================
echo   [*] Iniciando Modo Kiosco de Escritorio (Electron)...
echo   (Nota: Para ejecutar la version de navegador web, use run_web.bat)
echo ===================================================================

if not exist "frontend\dist\index.html" (
    echo [!] frontend\dist no encontrado. Compilando aplicacion...
    cd frontend
    if not exist "node_modules" call npm install --include=dev
    call npm run build
    cd ..
)

echo.
echo [1/2] Iniciando Backend FastAPI en http://0.0.0.0:8000...
start "Backend FastAPI (Puerto 8000)" cmd /c "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak > nul

echo [2/2] Iniciando Terminal de Kiosco Electron...
start "Kiosco Electron" cmd /c "cd frontend && npm run start"

echo.
echo ===================================================================
echo   Sistema ejecutandose con exito:
echo   - Frontend: Ventana Kiosco Electron
echo   - Backend API: http://127.0.0.1:8000 (Swagger: /docs)
echo   - Atajos: F11 (Pantalla Completa), Esc (Modo Ventana)
echo ===================================================================
pause
exit /b 0
