<#
.SYNOPSIS
    Lanzador para Windows en PowerShell del Sistema de Cajero Automático ATM Kiosk.
.DESCRIPTION
    Permite iniciar el sistema completo en modo Kiosco Electron (predeterminado) o en
    Modo Servidor Web (-Web) con FastAPI y frontend estático accesible vía navegador.
.PARAMETER Web
    Inicia en modo Servidor Web omitiendo el lanzamiento de Electron.
.PARAMETER Port
    Puerto HTTP para servir el frontend en modo web (predeterminado: 5173).
.EXAMPLE
    .\run_windows.ps1
    .\run_windows.ps1 -Web
    .\run_windows.ps1 -Web -Port 3000
#>

[CmdletBinding()]
param(
    [switch]$Web,
    [int]$Port = 5173
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$ScriptDir\..\.."

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "  SISTEMA DE CAJERO AUTOMÁTICO BANCARIO EMBEBIDO (ATM KIOSK)" -ForegroundColor White
Write-Host "  Lanzador PowerShell para Windows 10/11" -ForegroundColor Gray
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

$mode = 1
if ($Web) {
    $mode = 2
} else {
    Write-Host "[*] Iniciando Modo Kiosco Electron (predeterminado)..." -ForegroundColor Yellow
    Write-Host "    (Para ejecutar en navegador web, use .\run_web.ps1 o el parametro -Web)" -ForegroundColor Gray
}

# 1. Verificar compilación del frontend
if (-not (Test-Path "frontend\dist\index.html")) {
    Write-Host "[!] frontend\dist no detectado. Compilando bundle de producción..." -ForegroundColor Yellow
    Set-Location "frontend"
    if (-not (Test-Path "node_modules")) {
        npm install --include=dev
    }
    npm run build
    Set-Location "$ScriptDir\..\.."
}

# 2. Iniciar Backend FastAPI
Write-Host "`n[1/2] Iniciando Backend FastAPI en http://0.0.0.0:8000..." -ForegroundColor Green
$backendProc = Start-Process python -ArgumentList "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000" -PassThru

Start-Sleep -Seconds 2

if ($mode -eq 2) {
    # Modo Servidor Web
    Write-Host "[2/2] Iniciando Servidor Web en http://localhost:$Port..." -ForegroundColor Green
    $webProc = Start-Process python -ArgumentList "-m http.server $Port --directory frontend\dist" -PassThru
    Start-Sleep -Seconds 1

    Start-Process "http://localhost:$Port"

    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback|vEthernet" } | Select-Object -First 1).IPAddress
    Write-Host ""
    Write-Host "===================================================================" -ForegroundColor Cyan
    Write-Host "  MODO SERVIDOR WEB ACTIVO (SISTEMA DE CAJERO)" -ForegroundColor Green
    Write-Host "  - Frontend Local:       http://localhost:$Port" -ForegroundColor White
    if ($ip) {
        Write-Host "  - Frontend Red Local:   http://${ip}:$Port" -ForegroundColor White
    }
    Write-Host "  - Backend Swagger Docs: http://localhost:8000/docs" -ForegroundColor White
    Write-Host ""
    Write-Host "  La aplicación se ha abierto en su navegador web predeterminado." -ForegroundColor Gray
    Write-Host "  Presione Ctrl+C en esta ventana para cerrar los servidores." -ForegroundColor Gray
    Write-Host "===================================================================" -ForegroundColor Cyan

    try {
        $backendProc.WaitForExit()
    } finally {
        if (-not $backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force }
        if (-not $webProc.HasExited) { Stop-Process -Id $webProc.Id -Force }
    }
} else {
    # Modo Kiosco Electron
    Write-Host "[2/2] Iniciando Terminal de Kiosco Electron..." -ForegroundColor Green
    Set-Location "frontend"
    npm run start
    Set-Location "$ScriptDir\..\.."

    Write-Host ""
    Write-Host "===================================================================" -ForegroundColor Cyan
    Write-Host "  Kiosco finalizado. Cerrando backend..." -ForegroundColor Gray
    Write-Host "===================================================================" -ForegroundColor Cyan
    if (-not $backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force }
}
