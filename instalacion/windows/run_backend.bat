@echo off
title Servidor Backend FastAPI (Cajero ATM)
cd /d "%~dp0\.."
REM Asegurar que el entorno de Python este en el PATH
if exist "%LOCALAPPDATA%\Python\bin" set "PATH=%LOCALAPPDATA%\Python\bin;%LOCALAPPDATA%\Python\pythoncore-3.14-64\Scripts;%PATH%"
if exist "%LOCALAPPDATA%\Programs\Python\Python314" set "PATH=%LOCALAPPDATA%\Programs\Python\Python314;%LOCALAPPDATA%\Programs\Python\Python314\Scripts;%PATH%"
if exist "%LOCALAPPDATA%\Programs\Python\Python312" set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"
if exist "%ProgramFiles%\Python314" set "PATH=%ProgramFiles%\Python314;%ProgramFiles%\Python314\Scripts;%PATH%"
if exist "%ProgramFiles%\Python312" set "PATH=%ProgramFiles%\Python312;%ProgramFiles%\Python312\Scripts;%PATH%"

REM Resolver interprete de Python
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

echo [*] Iniciando Backend FastAPI en http://127.0.0.1:8000...
"%PYTHON_CMD%" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
pause
