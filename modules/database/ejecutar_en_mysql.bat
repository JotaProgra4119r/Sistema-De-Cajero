@echo off
title Creacion de Base de Datos MySQL - ATM Kiosk
cd /d "%~dp0"
echo ===================================================================
echo      CREACION DE BASE DE DATOS SQL: atm_system (MySQL 8.0 / 8.4)
echo ===================================================================
echo.
echo Este script creara la base de datos "atm_system", todas sus tablas,
echo restricciones (PK, FK, CHECK), roles, inventario de boveda y los
echo 6 usuarios corporativos iniciales (1 Admin y 5 Empleados).
echo.

set MYSQL_BIN="C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"

if not exist %MYSQL_BIN% (
    echo [AVISO] No se encontro mysql.exe en la ruta predeterminada de MySQL 8.0.
    echo Intentando comando 'mysql' directo desde el PATH...
    set MYSQL_BIN=mysql
)

set /p DB_PASS=Ingrese la contrasena de root de MySQL (o presione ENTER si no tiene): 

echo.
echo [1/2] Ejecutando schema.sql en MySQL...
if "%DB_PASS%"=="" (
    %MYSQL_BIN% -u root < schema.sql
) else (
    %MYSQL_BIN% -u root -p%DB_PASS% < schema.sql
)

if %ERRORLEVEL% equ 0 (
    echo.
    echo ===================================================================
    echo [EXITO] Base de datos "atm_system" creada y semillada exitosamente.
    echo ===================================================================
    echo.
    echo Generando archivo de configuracion .env con sus credenciales...
    (
        echo # Base de Datos MySQL
        echo DB_HOST=127.0.0.1
        echo DB_PORT=3306
        echo DB_NAME=atm_system
        echo DB_USER=root
        echo DB_PASSWORD=%DB_PASS%
        echo.
        echo # API Backend y Seguridad
        echo API_PORT=8000
        echo API_HOST=127.0.0.1
        echo JWT_SECRET=super_secret_jwt_key_here_bank_atm_2026
        echo ALLOW_DEMO_MFA=true
        echo.
        echo # Hardware Embebido
        echo SERIAL_PORT=COM3
        echo SERIAL_BAUDRATE=115200
        echo ESP32_IP=192.168.1.50
        echo MOCK_HARDWARE=true
        echo.
        echo # Persistencia Dual (.txt)
        echo TXT_STORAGE_PATH=./data/storage_txt/
    ) > ..\.env
    echo Archivo .env configurado correctamente en la raiz del proyecto.
) else (
    echo.
    echo [ERROR] No se pudo conectar a MySQL. Verifique su contrasena.
    echo Tambien puede abrir 'database\schema.sql' directamente en MySQL Workbench y ejecutarlo.
)

echo.
pause
