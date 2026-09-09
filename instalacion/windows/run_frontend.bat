@echo off
title Frontend Kiosk - Sistema de Cajero
cd /d "%~dp0\..\.."
cd frontend
echo Iniciando interfaz Electron en modo Kiosco...
npm run start
pause
