@echo off
title Backend Sistema Bancario Cajero ATM
echo ===================================================
echo   INICIANDO BACKEND FASTAPI (SISTEMA BANCARIO ATM)
echo ===================================================
cd /d "%~dp0"
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
pause
