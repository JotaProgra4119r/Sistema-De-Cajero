@echo off
title Terminal Kiosco Frontend (Cajero ATM)
cd /d "%~dp0\..\frontend"
npm run electron:dev
pause
