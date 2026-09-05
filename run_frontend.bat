@echo off
title Kiosco Cajero ATM (Electron / React)
echo ===================================================
echo   INICIANDO INTERFAZ KIOSCO TACTIL (DISCORD THEME)
echo ===================================================
cd /d "%~dp0frontend"
npm run electron:dev
pause
