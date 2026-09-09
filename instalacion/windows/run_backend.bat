@echo off
title Backend Core API - Sistema de Cajero
cd /d "%~dp0\..\.."
echo Iniciando Backend FastAPI en http://127.0.0.1:8000...
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
pause
