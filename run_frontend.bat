@echo off
title Kiosco Cajero ATM (Electron / React)
echo ===================================================
echo   INICIANDO INTERFAZ KIOSCO TACTIL (DISCORD THEME)
echo   - Modo Ventana (1400x900) con controles integrados
echo   - Pantalla Completa (F11 para alternar, Esc para salir)
echo ===================================================
cd /d "%~dp0frontend"
npm run start
pause
