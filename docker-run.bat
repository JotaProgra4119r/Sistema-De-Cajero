@echo off
title Lanzador Docker - Sistema Cajero Automatico Bancario
echo ===================================================================
echo   INICIANDO CONTENEDORES DOCKER (SOLO INSTALAR Y ABRIR)
echo ===================================================================
echo.

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker no esta instalado o no se encuentra en el PATH.
    echo Por favor instale Docker Desktop desde: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo [1/3] Levantando contenedores con docker-compose...
docker compose up -d --build

if %errorlevel% neq 0 (
    echo [ERROR] Fallo al iniciar los contenedores de Docker.
    pause
    exit /b 1
)

echo [2/3] Esperando inicializacion de servicios (10 segundos)...
timeout /t 10 /nobreak >nul

echo [3/3] Abriendo Kiosco en su navegador...
start http://localhost:5173

echo.
echo ===================================================================
echo   SISTEMA DE CAJERO EN EJECUCION VIA DOCKER
echo   - Frontend Kiosk:  http://localhost:5173 (o http://localhost)
echo   - Backend Core:    http://localhost:8000
echo   - Swagger API Docs: http://localhost:8000/docs
echo   - Healthcheck:     http://localhost:8000/health
echo.
echo   Para detener los contenedores ejecute: docker compose down
echo ===================================================================
pause
