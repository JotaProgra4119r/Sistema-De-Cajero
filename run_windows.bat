@echo off
title Lanzador Completo Sistema Bancario Cajero ATM
echo ===================================================
echo   LANZANDO SISTEMA COMPLETO CAJERO AUTOMATICO
echo   1. Servidor Backend Python FastAPI (Puerto 8000)
echo   2. Interfaz Kiosco Electron (Ventana y Pantalla Completa)
echo ===================================================
cd /d "%~dp0"
start "Backend FastAPI" cmd /c "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"
timeout /t 2 /nobreak > nul
start "Kiosco Electron" cmd /c "cd frontend && npm run start"
echo ===================================================
echo   Sistema ejecutandose en paralelo con exito.
echo   Atajos: F11 (Pantalla Completa), Esc (Modo Ventana)
echo ===================================================
pause
