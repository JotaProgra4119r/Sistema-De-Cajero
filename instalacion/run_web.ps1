<#
.SYNOPSIS
    Script de ejecución dedicado para el Sistema Bancario Cajero ATM en Modo Servidor Web.
.DESCRIPTION
    Inicia el servidor backend FastAPI (puerto 8000) y sirve la interfaz web optimizada (puerto 5173),
    abriendo automáticamente el navegador web predeterminado sin depender de Electron.
#>

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

$Port = 5173

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "   SISTEMA DE CAJERO AUTOMATICO BANCARIO - MODO SERVIDOR WEB       " -ForegroundColor Yellow
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar compilación de frontend
$DistIndex = Join-Path $ProjectRoot "frontend\dist\index.html"
if (-not (Test-Path $DistIndex)) {
    Write-Host "[!] Compilando frontend para distribución web..." -ForegroundColor Yellow
    Set-Location "$ProjectRoot\frontend"
    if (-not (Test-Path "node_modules")) {
        npm install --include=dev
    }
    npm run build
    Set-Location $ProjectRoot
}

# 1. Iniciar Backend FastAPI
Write-Host "[1/2] Iniciando Backend FastAPI en http://0.0.0.0:8000..." -ForegroundColor Green
Start-Process -FilePath "python" -ArgumentList "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000" -NoNewWindow:$false | Out-Null

Start-Sleep -Seconds 2

# 2. Iniciar Servidor Web
Write-Host "[2/2] Iniciando Servidor Web Frontend en http://localhost:$Port..." -ForegroundColor Green
Start-Process -FilePath "python" -ArgumentList "-m http.server $Port --directory frontend\dist" -NoNewWindow:$false | Out-Null

Start-Sleep -Seconds 1

Write-Host ""
Write-Host "[*] Abriendo navegador predeterminado..." -ForegroundColor Cyan
Start-Process "http://localhost:$Port"

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
Write-Host "   SERVIDOR WEB ACTIVO CON EXITO                                   " -ForegroundColor White
Write-Host "   - Frontend Web:  http://localhost:$Port                         " -ForegroundColor Cyan
Write-Host "   - Backend API:   http://127.0.0.1:8000 (Docs: /docs)            " -ForegroundColor Yellow
Write-Host "===================================================================" -ForegroundColor Green
Write-Host "Presione cualquier tecla para salir (los servicios continuaran en segundo plano)..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
