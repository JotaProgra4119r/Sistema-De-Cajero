@echo off
title Sistema Bancario Cajero ATM - Servidor Web
cd /d "%~dp0\..\.."

set "PORT=5173"

echo ===================================================================
echo   SISTEMA DE CAJERO AUTOMATICO BANCARIO - MODO SERVIDOR WEB
echo ===================================================================
echo.

if not exist "frontend\dist\index.html" (
    echo [!] frontend\dist no encontrado. Compilando aplicacion web optimizada...
    cd frontend
    if not exist "node_modules" call npm install --include=dev
    call npm run build
    cd ..
)

echo [1/2] Iniciando Backend FastAPI en http://0.0.0.0:8000...
start "Backend FastAPI (Puerto 8000)" cmd /c "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak > nul

echo [2/2] Iniciando Servidor Web Frontend en http://localhost:%PORT%...
start "Servidor Web Frontend (Puerto %PORT%)" cmd /c "python -m http.server %PORT% --directory frontend\dist"

timeout /t 1 /nobreak > nul

echo.
echo [*] Abriendo navegador predeterminado en http://localhost:%PORT%...
start http://localhost:%PORT%

echo.
echo ===================================================================
echo   SERVIDOR WEB INICIADO CON EXITO
echo   - Frontend Web:  http://localhost:%PORT%
echo   - Backend API:   http://127.0.0.1:8000 (Swagger: http://127.0.0.1:8000/docs)
echo.
echo   La aplicacion se ejecuta en el navegador web.
echo ===================================================================
pause
exit /b 0
