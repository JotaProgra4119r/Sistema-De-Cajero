@echo off
title Apertura de Puertos Cajero ATM - Red Multicajero e Interbancaria
cd /d "%~dp0"

:: Auto-elevación a Administrador si es necesario
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Solicitando elevacion de Administrador para configurar Firewall de Windows...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ===================================================================
echo   APERTURA DE PUERTOS DE RED EN FIREWALL DE WINDOWS
echo ===================================================================
echo.
echo Configurando reglas de entrada para interconexion de cajeros y routers:
echo  - Puerto 8000 / 8080 (TCP)       : API Backend FastAPI
echo  - Puerto 5173 / 3000 (TCP)       : Frontend Web y Kiosco ATM
echo  - Puerto 5000 (TCP)              : Protocolo Interbancario TCP Base
echo  - Puerto 5005 (UDP)              : Descubrimiento Interbancario UDP Broadcast
echo  - Puerto 5040 / 40 (TCP/UDP)     : Red Wi-Fi (040)
echo  - Puerto 5034 / 34 (TCP/UDP)     : Red Ethernet (034)
echo  - Puertos 5001-5010 (TCP)        : Routers Auxiliares y Nodos Estudiantiles
echo  - Puerto 1433 (TCP) / 1434 (UDP) : Microsoft SQL Server 2022 (sqlserver22 / SQLEXPRESS)
echo  - Puerto 3306 (TCP)              : Base de Datos Relacional MySQL 8.0
echo.

:: 1. Backend FastAPI & Web
netsh advfirewall firewall add rule name="ATM_Backend_8000" dir=in action=allow protocol=TCP localport=8000 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Backend_8080" dir=in action=allow protocol=TCP localport=8080 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Frontend_5173" dir=in action=allow protocol=TCP localport=5173 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Frontend_3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1

:: 2. Protocolo Interbancario TCP Base y Descubrimiento UDP
netsh advfirewall firewall add rule name="ATM_Interbank_TCP_5000" dir=in action=allow protocol=TCP localport=5000 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_UDP_5005" dir=in action=allow protocol=UDP localport=5005 profile=any >nul 2>&1

:: 3. Puertos Wi-Fi (040 / 5040)
netsh advfirewall firewall add rule name="ATM_Interbank_WiFi_5040" dir=in action=allow protocol=TCP localport=5040 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_WiFi_UDP_5040" dir=in action=allow protocol=UDP localport=5040 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_WiFi_40" dir=in action=allow protocol=TCP localport=40 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_WiFi_UDP_40" dir=in action=allow protocol=UDP localport=40 profile=any >nul 2>&1

:: 4. Puertos Ethernet (034 / 5034)
netsh advfirewall firewall add rule name="ATM_Interbank_Eth_5034" dir=in action=allow protocol=TCP localport=5034 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_Eth_UDP_5034" dir=in action=allow protocol=UDP localport=5034 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_Eth_34" dir=in action=allow protocol=TCP localport=34 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_Eth_UDP_34" dir=in action=allow protocol=UDP localport=34 profile=any >nul 2>&1

:: 5. Puertos Auxiliares entre Routers (5001-5010)
netsh advfirewall firewall add rule name="ATM_Interbank_Aux_5001" dir=in action=allow protocol=TCP localport=5001 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_Aux_5002" dir=in action=allow protocol=TCP localport=5002 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_Aux_5003" dir=in action=allow protocol=TCP localport=5003 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_Aux_5004" dir=in action=allow protocol=TCP localport=5004 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_Aux_5010" dir=in action=allow protocol=TCP localport=5010 profile=any >nul 2>&1

:: 6. Bases de Datos: Microsoft SQL Server 2022 y MySQL
netsh advfirewall firewall add rule name="ATM_SQLServer_1433" dir=in action=allow protocol=TCP localport=1433 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_SQLBrowser_1434" dir=in action=allow protocol=UDP localport=1434 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_MySQL_3306" dir=in action=allow protocol=TCP localport=3306 profile=any >nul 2>&1

echo ===================================================================
echo   [OK] Reglas de firewall de Windows configuradas exitosamente.
echo   Todos los puertos de routers, cajeros y base de datos estan abiertos.
echo ===================================================================
timeout /t 3 >nul
