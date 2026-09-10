@echo off
title Sistema Bancario Cajero ATM
cd /d "%~dp0\..\.."

set "PORT=5173"
set "MODE=1"

if /i "%~1"=="--web" goto set_web
if /i "%~1"=="-web" goto set_web
if /i "%~1"=="/web" goto set_web

echo ===================================================================
echo   SISTEMA DE CAJERO AUTOMATICO BANCARIO EMBEBIDO (ATM KIOSK)
echo ===================================================================
echo   Seleccione el modo de ejecucion:
echo     [1] Modo Kiosco Electron (Escritorio / Pantalla Tactil)
echo     [2] Modo Servidor Web (FastAPI + Frontend Web en Navegador)
echo ===================================================================
set /p "CHOICE=Ingrese opcion [1-2] (predeterminado 1): "
if "%CHOICE%"=="2" goto set_web
goto run_kiosk

:set_web
set "MODE=2"
echo.
echo [*] Modo Servidor Web seleccionado.
goto check_frontend

:run_kiosk
set "MODE=1"
echo.
echo [*] Modo Kiosco Electron seleccionado.
goto check_frontend

:check_frontend
if not exist "frontend\dist\index.html" (
    echo [!] frontend\dist no encontrado. Compilando aplicacion web...
    cd frontend
    if not exist "node_modules" call npm install --include=dev
    call npm run build
    cd ..
)

echo.
echo [1/2] Iniciando Backend FastAPI en http://0.0.0.0:8000...
start "Backend FastAPI (Puerto 8000)" cmd /c "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak > nul

if "%MODE%"=="2" goto launch_web
goto launch_electron

:launch_electron
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

:launch_web
echo [2/2] Iniciando Servidor Web Estatico en http://localhost:%PORT%...
start "Servidor Web Frontend (Puerto %PORT%)" cmd /c "python -m http.server %PORT% --directory frontend\dist"
timeout /t 1 /nobreak > nul
start http://localhost:%PORT%
echo.
echo ===================================================================
echo   MODO SERVIDOR WEB ACTIVO (SISTEMA DE CAJERO)
echo   - Frontend URL:  http://localhost:%PORT%
echo   - Backend API:   http://127.0.0.1:8000 (Swagger: http://127.0.0.1:8000/docs)
echo.
echo   La aplicacion se ha abierto en su navegador predeterminado.
echo   Puede accederse desde cualquier dispositivo en la red local.
echo ===================================================================
pause
exit /b 0
