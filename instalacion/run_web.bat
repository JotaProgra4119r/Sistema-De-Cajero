@echo off
title Sistema Bancario Cajero ATM - Servidor Web
cd /d "%~dp0\.."

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

REM Asegurar que el entorno de Python este en el PATH
if exist "%LOCALAPPDATA%\Python\bin" set "PATH=%LOCALAPPDATA%\Python\bin;%LOCALAPPDATA%\Python\pythoncore-3.14-64\Scripts;%PATH%"
if exist "%LOCALAPPDATA%\Programs\Python\Python314" set "PATH=%LOCALAPPDATA%\Programs\Python\Python314;%LOCALAPPDATA%\Programs\Python\Python314\Scripts;%PATH%"
if exist "%LOCALAPPDATA%\Programs\Python\Python313" set "PATH=%LOCALAPPDATA%\Programs\Python\Python313;%LOCALAPPDATA%\Programs\Python\Python313\Scripts;%PATH%"
if exist "%LOCALAPPDATA%\Programs\Python\Python312" set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"
if exist "%ProgramFiles%\Python314" set "PATH=%ProgramFiles%\Python314;%ProgramFiles%\Python314\Scripts;%PATH%"
if exist "%ProgramFiles%\Python313" set "PATH=%ProgramFiles%\Python313;%ProgramFiles%\Python313\Scripts;%PATH%"
if exist "%ProgramFiles%\Python312" set "PATH=%ProgramFiles%\Python312;%ProgramFiles%\Python312\Scripts;%PATH%"

REM Resolver ejecutable de Python funcional
set "PYTHON_CMD="
if exist "%LOCALAPPDATA%\Python\bin\python.exe" (
    set "PYTHON_CMD=%LOCALAPPDATA%\Python\bin\python.exe"
) else (
    python -c "import sys" >nul 2>nul
    if %errorlevel% equ 0 (
        set "PYTHON_CMD=python"
    ) else (
        if exist "%LOCALAPPDATA%\Programs\Python\Python314\python.exe" set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python314\python.exe"
        if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
        if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
        if exist "%ProgramFiles%\Python314\python.exe" set "PYTHON_CMD=%ProgramFiles%\Python314\python.exe"
        if exist "%ProgramFiles%\Python313\python.exe" set "PYTHON_CMD=%ProgramFiles%\Python313\python.exe"
        if exist "%ProgramFiles%\Python312\python.exe" set "PYTHON_CMD=%ProgramFiles%\Python312\python.exe"
        if exist "%ProgramFiles%\Python311\python.exe" set "PYTHON_CMD=%ProgramFiles%\Python311\python.exe"
        if exist "%ProgramFiles%\Python310\python.exe" set "PYTHON_CMD=%ProgramFiles%\Python310\python.exe"
    )
)
if not defined PYTHON_CMD set "PYTHON_CMD=python"

echo [*] Verificando y liberando puerto 8000 si estuviera ocupado...
"%PYTHON_CMD%" -c "import psutil; [p.kill() for p in psutil.process_iter() if any(getattr(getattr(c, 'laddr', None), 'port', None) == 8000 for c in getattr(p, 'net_connections', lambda *a: [])('inet'))]" >nul 2>nul

echo [1/2] Iniciando Backend FastAPI en http://0.0.0.0:8000...
start "Backend FastAPI (Puerto 8000)" cmd /k ""%PYTHON_CMD%" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

"%PYTHON_CMD%" -c "import time; time.sleep(1.5)"

echo [2/2] Iniciando Servidor Web Frontend en http://localhost:%PORT%...
start "Servidor Web Frontend (Puerto %PORT%)" cmd /k ""%PYTHON_CMD%" -m http.server %PORT% --directory frontend\dist"

"%PYTHON_CMD%" -c "import time; time.sleep(1)"

echo.
echo [*] Abriendo navegador predeterminado en http://localhost:%PORT%...
start http://localhost:%PORT%

echo.
echo ===================================================================
echo   SERVIDOR WEB INICIADO CON EXITO
echo   - Frontend Web:  http://localhost:%PORT%
echo   - Backend API:   http://127.0.0.1:8000 (Swagger: http://127.0.0.1:8000/docs)
echo.
echo   La aplicacion se ejecuta de forma desacoplada en el navegador web.
echo   Para detener los servicios, cierre las ventanas de consola auxiliares.
echo ===================================================================
pause
exit /b 0
