# Módulo de Backend y Motor Transaccional Bancario (`backend/`)

## 1. Propósito e Importancia Crítica en el Sistema
El módulo `backend/` es el núcleo transaccional, cerebro lógico y API Gateway del Cajero Automático Embebido. Implementado con **FastAPI**, **SQLAlchemy** y **WebSockets**, actúa como el garante de las reglas de negocio bancarias y el puente seguro entre la terminal táctil y los actuadores mecánicos.

### ¿Por qué es crítico?
- **Garantía Transaccional ACID:** Toda mutación de saldos contables, límites de retiro diario y stock de efectivo en bóveda se ejecuta bajo transacciones atómicas. El uso de bloqueo a nivel de fila (`with_for_update()`) en el inventario de billetes erradica por completo las condiciones de carrera (Race Conditions) en operaciones concurrentes.
- **Seguridad Criptográfica y Anti-Fraude:** Protege la autenticación mediante verificación de PIN en tiempo constante con hash SHA-256 salteado (`hmac.compare_digest`), tokens dinámicos TOTP con protección estricta contra ataques de repetición (Replay Attacks) y sesiones autenticadas mediante JWT criptográficamente firmado.
- **Orquestación Física en Tiempo Real:** Solo tras la confirmación de eyección física de billetes por parte de los sensores ópticos del microcontrolador (módulo `sensors/`), se consolida el débito contable. En caso de atasco mecánico (*Jam*), la transacción revierte automáticamente (*Rollback* contable).

---

## 2. Estructura de Archivos y Responsabilidad de Componentes

```
backend/
├── app/
│   ├── api/
│   │   ├── admin.py             # Endpoints administrativos: arqueo inicial, recargas, límites y bajas lógicas.
│   │   ├── auth.py              # Endpoints de autenticación bancaria MFA: validación de tarjeta, PIN y TOTP.
│   │   ├── deps.py              # Inyección de dependencias FastAPI: extracción y validación de tokens JWT (User/Admin).
│   │   ├── hardware.py          # Endpoints de control y telemetría de hardware: estado de sensores y simulación de fallas.
│   │   ├── user.py              # Endpoints del cliente: retiros arbitrarios, depósitos, transacciones y cambio de PIN.
│   │   └── ws.py                # Servidor WebSocket (`/ws/hardware`) para emisión reactiva de eventos de dispensación.
│   ├── core/
│   │   ├── config.py            # Configuración centralizada vía Pydantic Settings (CORS, JWT, puertos, DB).
│   │   └── security.py          # Primitivas criptográficas: hash de PIN con sal, tokens TOTP con anti-replay y JWT.
│   ├── db/
│   │   ├── database.py          # Re-exportador de compatibilidad de la conexión a base de datos.
│   │   ├── init_db.py           # Re-exportador del semillado de datos del sistema.
│   │   └── models.py            # Re-exportador de modelos ORM relacionales.
│   ├── hardware/
│   │   ├── esp32_controller.py  # Re-exportador del driver de visión y sensor ultrasónico.
│   │   └── serial_controller.py # Re-exportador del driver de dispensación y comunicación serial.
│   ├── services/
│   │   └── banking_service.py   # Servicio transaccional integral: reglas contables, arqueos, bóveda y soft delete.
│   └── storage_txt/
│       └── txt_manager.py       # Re-exportador de sincronización de persistencia plana.
├── tests/
│   ├── test_banking.py          # Suite de pruebas funcionales de negocio (login, retiros, límites, jam, soft-delete).
│   └── test_dual_write.py       # Suite de verificación de consistencia en archivos planos `.txt`.
├── main.py                      # Punto de entrada de la aplicación FastAPI, middlewares de CORS y ciclo de vida (lifespan).
├── pytest.ini                   # Configuración del entorno de pruebas unitarias.
└── requirements.txt             # Dependencias: fastapi, uvicorn, sqlalchemy, pymysql, pyjwt, pyserial, pytest.
```

---

## 3. Catálogo de Endpoints de la API Bancaria

### Autenticación y Seguridad (`/api/auth`)
- `POST /api/auth/login`: Autenticación bancaria multi-factor (MFA). Recibe número de tarjeta (16 dígitos), PIN (4 dígitos), token dinámico TOTP (6 dígitos) y rol. Retorna token JWT y perfil del usuario.
- `GET /api/auth/token-preview`: Genera la previsualización del token TOTP vigente para pruebas en pantalla.

### Operaciones de Usuario (`/api/user`)
- `GET /api/user/summary`: Retorna el saldo actual, límite diario, total retirado hoy, cupo disponible y stock físico de bóveda.
- `POST /api/user/withdraw`: Procesa retiros de efectivo con montos arbitrarios no estandarizados y desglose en billetes de Quetzales.
- `POST /api/user/deposit`: Acepta depósitos en efectivo desglosados validando el tope máximo de la bóveda (Q30,000.00).
- `GET /api/user/transactions`: Retorna las últimas 5 transacciones registradas del usuario desde la persistencia plana.
- `POST /api/user/change-pin`: Actualiza el PIN confidencial del usuario verificando el PIN actual y token dinámico.
- `GET /api/user/audit/deleted-records`: Retorna el historial transparente de tarjetas o registros desactivados asociados a la cuenta del usuario.

### Consola Administrativa (`/api/admin`)
- `GET /api/admin/metrics`: Métricas de bóveda (saldo, porcentaje, transacciones, estado de inicialización y auditoría).
- `POST /api/admin/vault/initialize`: Arqueo e inicialización obligatoria de bóveda (tope estricto de Q10,000.00).
- `POST /api/admin/vault/add-cash`: Recarga de efectivo acumulado en bóveda (tope consolidado de Q30,000.00).
- `POST /api/admin/users/register`: Alta de nuevos trabajadores corporativos con tarjeta y límite asignado.
- `POST /api/admin/users/reassign-card`: Sustitución de tarjeta de plástico preservando consumos diarios del usuario.
- `POST /api/admin/users/adjust-limit`: Ajuste individual de límite máximo de retiro diario.
- `POST /api/admin/users/soft-delete` & `DELETE /api/admin/users/{id}`: Baja lógica inmutable con instantánea JSON de auditoría.
- `GET /api/admin/audit/deleted-records`: Reporte completo de bajas lógicas y registros archivados en el sistema.

### Telemetría de Hardware (`/api/hardware`)
- `GET /api/hardware/status`: Estado del puerto serial RS-232, sensores ópticos, cámara ESP32 y presencia ultrasónica.
- `POST /api/hardware/simulate-jam`: Activa/desactiva la simulación de atascos mecánicos en los motores para pruebas de resiliencia.
- `WebSocket /ws/hardware`: Canal bidireccional en tiempo real para eventos de inicio y finalización de dispensación de billetes.

---

## 4. Guía Operativa de Ejecución y Pruebas

### Instalación de Dependencias de Python:
```bash
pip install -r requirements.txt
```

### Iniciar el Servidor API Gateway:
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
Documentación interactiva Swagger UI disponible en: `http://127.0.0.1:8000/docs`.

### Ejecutar Suite Completa de Pruebas Unitarias:
```bash
pytest backend/tests/ -v
```
*Garantiza el 100% de aprobación en los 15 casos de prueba de negocio y persistencia.*

---

## 5. Directrices para el Agente de IA (`feature/backend-core`)

- **Rama Exclusiva:** `feature/backend-core` (prohibido hacer push directo a `main`).
- **Seguridad Primero:** Queda terminantemente prohibido introducir listas de bypass quemadas, contraseñas en texto claro o deshabilitar la caché anti-replay de tokens TOTP.
- **Validación Obligatoria:** Ejecutar siempre `pytest backend/tests/ -v` antes de proponer un Pull Request.
- **Atomicidad:** Toda operación financiera debe envolverse en transacción de base de datos con manejo de errores explícito y reversión (`db.rollback()`) ante fallos.
