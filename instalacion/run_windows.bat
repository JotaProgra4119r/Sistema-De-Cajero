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

echo.
echo [*] Verificando y liberando puerto 8000 si estuviera ocupado...
"%PYTHON_CMD%" -c "import psutil; [p.kill() for p in psutil.process_iter() if any(getattr(getattr(c, 'laddr', None), 'port', None) == 8000 for c in getattr(p, 'net_connections', lambda *a: [])('inet'))]" >nul 2>nul

echo.
echo [1/2] Iniciando Backend FastAPI en http://0.0.0.0:8000...
start "Backend FastAPI (Puerto 8000)" cmd /k ""%PYTHON_CMD%" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

"%PYTHON_CMD%" -c "import time; time.sleep(1.5)"

echo [2/2] Iniciando Terminal de Kiosco Electron...
start "Kiosco Electron" cmd /c "cd /d ""%~dp0..\frontend"" && npm.cmd run start"

echo.
echo ===================================================================
echo   Sistema ejecutandose con exito:
echo   - Frontend: Ventana Kiosco Electron
echo   - Backend API: http://127.0.0.1:8000 (Swagger: /docs)
echo   - Atajos: F11 (Pantalla Completa), Esc (Modo Ventana)
echo ===================================================================
pause
exit /b 0
