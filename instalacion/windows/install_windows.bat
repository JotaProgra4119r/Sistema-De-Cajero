@echo off
title Instalador Sistema Bancario Cajero ATM (Windows)
cd /d "%~dp0\.."
echo ===================================================================
echo   INSTALACION DE DEPENDENCIAS (WINDOWS)
echo ===================================================================
echo.

REM Asegurar que el entorno de Python este en el PATH
if exist "%LOCALAPPDATA%\Python\bin" set "PATH=%LOCALAPPDATA%\Python\bin;%LOCALAPPDATA%\Python\pythoncore-3.14-64\Scripts;%PATH%"
if exist "%LOCALAPPDATA%\Programs\Python\Python314" set "PATH=%LOCALAPPDATA%\Programs\Python\Python314;%LOCALAPPDATA%\Programs\Python\Python314\Scripts;%PATH%"
if exist "%LOCALAPPDATA%\Programs\Python\Python312" set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"
if exist "%ProgramFiles%\Python314" set "PATH=%ProgramFiles%\Python314;%ProgramFiles%\Python314\Scripts;%PATH%"
if exist "%ProgramFiles%\Python312" set "PATH=%ProgramFiles%\Python312;%ProgramFiles%\Python312\Scripts;%PATH%"

set "PYTHON_CMD="
if exist "%LOCALAPPDATA%\Python\bin\python.exe" (
    set "PYTHON_CMD=%LOCALAPPDATA%\Python\bin\python.exe"
) else (
    python -c "import sys" >nul 2>nul
    if %errorlevel% equ 0 (
        set "PYTHON_CMD=python"
    ) else (
        if exist "%LOCALAPPDATA%\Programs\Python\Python314\python.exe" set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python314\python.exe"
        if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
        if exist "%ProgramFiles%\Python314\python.exe" set "PYTHON_CMD=%ProgramFiles%\Python314\python.exe"
        if exist "%ProgramFiles%\Python312\python.exe" set "PYTHON_CMD=%ProgramFiles%\Python312\python.exe"
    )
)
if not defined PYTHON_CMD set "PYTHON_CMD=python"

echo [1/3] Instalando librerias de Python...
"%PYTHON_CMD%" -m pip install -r requirements.txt

echo [2/3] Inicializando base de datos local y tablas...
"%PYTHON_CMD%" database/init_db.py

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
