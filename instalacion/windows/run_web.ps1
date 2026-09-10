<#
.SYNOPSIS
    Script de ejecución dedicado para el Sistema Bancario Cajero ATM en Modo Servidor Web (Windows).
#>

$ProjectRoot = Resolve-Path "$PSScriptRoot\..\.."
Set-Location $ProjectRoot

$Port = 5173

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "   SISTEMA DE CAJERO AUTOMATICO BANCARIO - MODO SERVIDOR WEB       " -ForegroundColor Yellow
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

$DistIndex = Join-Path $ProjectRoot "frontend\dist\index.html"
if (-not (Test-Path $DistIndex)) {
    Write-Host "[!] Compilando frontend para distribucion web..." -ForegroundColor Yellow
    Set-Location "$ProjectRoot\frontend"
    if (-not (Test-Path "node_modules")) {
        npm install --include=dev
    }
    npm run build
    Set-Location $ProjectRoot
}

Write-Host "[1/2] Iniciando Backend FastAPI en http://0.0.0.0:8000..." -ForegroundColor Green
Start-Process -FilePath "python" -ArgumentList "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000" -NoNewWindow:$false | Out-Null

Start-Sleep -Seconds 2

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
Write-Host "Presione cualquier tecla para salir..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
