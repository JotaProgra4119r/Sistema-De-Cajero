@echo off
title Apertura de Puertos Cajero ATM - Red Multicajero e Interbancaria
echo ===================================================================
echo   APERTURA DE PUERTOS DE RED EN FIREWALL DE WINDOWS
echo ===================================================================
echo.
echo Abriendo puertos para comunicacion entre routers y cajeros:
echo  - Puerto 8000 (TCP)  : API Backend FastAPI
echo  - Puerto 5173 (TCP)  : Frontend Web y Kiosco
echo  - Puerto 5000 (TCP)  : Protocolo Interbancario TCP
echo  - Puerto 5005 (UDP)  : Descubrimiento Interbancario UDP
echo  - Puerto 5040 / 40 (TCP/UDP): Red Wi-Fi (040)
echo  - Puerto 5034 / 34 (TCP/UDP): Red Ethernet (034)
echo  - Puerto 1433 (TCP)  : Microsoft SQL Server 2022
echo  - Puerto 1434 (UDP)  : SQL Server Browser
echo.

netsh advfirewall firewall add rule name="ATM_Backend_8000" dir=in action=allow protocol=TCP localport=8000 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Frontend_5173" dir=in action=allow protocol=TCP localport=5173 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_TCP_5000" dir=in action=allow protocol=TCP localport=5000 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_UDP_5005" dir=in action=allow protocol=UDP localport=5005 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_WiFi_5040" dir=in action=allow protocol=TCP localport=5040 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_WiFi_UDP_5040" dir=in action=allow protocol=UDP localport=5040 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_WiFi_40" dir=in action=allow protocol=TCP localport=40 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_Eth_5034" dir=in action=allow protocol=TCP localport=5034 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_Eth_UDP_5034" dir=in action=allow protocol=UDP localport=5034 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_Interbank_Eth_34" dir=in action=allow protocol=TCP localport=34 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_SQLServer_1433" dir=in action=allow protocol=TCP localport=1433 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="ATM_SQLBrowser_1434" dir=in action=allow protocol=UDP localport=1434 profile=any >nul 2>&1

echo [OK] Reglas de firewall configuradas. Si requiere permisos de Administrador,
echo      ejecute este archivo con click derecho -> 'Ejecutar como administrador'.
echo ===================================================================
pause
