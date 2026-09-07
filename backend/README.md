# Módulo de Backend y Motor Transaccional Bancario (Backend Module)

## 1. Visión General del Core Transaccional
El módulo `backend/` implementa el API Gateway bancario y orquestador transaccional de alta disponibilidad para el Cajero Automático Embebido. Desarrollado con **FastAPI**, **SQLAlchemy** y **WebSockets**, administra:
1. **Autenticación Multi-Factor (MFA):** Verificación de tarjeta de 16 dígitos, PIN de 4 dígitos mediante hash con sal SHA-256 en tiempo constante, y tokens TOTP dinámicos de un solo uso con protección contra ataques de repetición (Anti-Replay).
2. **Motor de Transacciones Financieras:** Retiros y depósitos en Quetzales con validación aritmética estricta, límites diarios parametrizables y prevención de condiciones de carrera mediante bloqueo de registros (`with_for_update()`).
3. **Persistencia Dual Concurrente:** Coordinación atómica entre la base de datos relacional (`database/`) y los archivos planos de texto (`database/storage_txt/` y `data/storage_txt/`).
4. **Telemetría y Control de Hardware:** Interfaz de comunicación asíncrona con el módulo `sensors/` para comando de actuadores y sensor ultrasónico/cámara mediante eventos WebSocket en tiempo real.

---

## 2. Hardening y Mitigación de Vulnerabilidades de Seguridad
En esta versión se implementaron las siguientes correcciones de ciberseguridad bancaria:
- **Eliminación de Backdoors de PIN:** Se erradicó la verificación estática de PINs ("1234" sobre hashes bcrypt) y comparaciones en texto claro. La validación ahora es estrictamente criptográfica (`hmac.compare_digest`).
- **Prevención de Ataques de Repetición TOTP:** Se implementó una memoria caché de consumo de tokens dinámicos (`_consumed_totp_tokens`). Ningún token TOTP puede ser reutilizado dentro de su ventana de validez. Se eliminaron listas estáticas de bypass en producción.
- **Protección CORS Estricta:** Se eliminó la política permisiva `allow_origins=["*"]`, restringiendo las peticiones exclusivamente a los dominios autorizados en `settings.ALLOWED_ORIGINS` (Kiosco Electron y Vite local).
- **Consistencia Temporal UTC:** Sustitución de `datetime.utcnow()` por `datetime.now(timezone.utc)` para evitar discrepancias de zona horaria o advertencias en entornos Python 3.12+.
- **Aislamiento de Concurrencia en Bóveda:** Consultas de inventario de efectivo aseguradas con `SELECT ... FOR UPDATE` para evitar inconsistencias contables ante solicitudes concurrentes.

---

## 3. Arquitectura de Borrado Lógico (Soft Delete)
Queda prohibida toda sentencia `DELETE` destructiva en la base de datos.
- **Endpoints de Baja Lógica:**
  - `POST /api/admin/users/soft-delete` & `DELETE /api/admin/users/{user_id}`: Marca al usuario con `is_deleted=True`, desactiva sus plásticos asociados y almacena una instantánea JSON en `registros_eliminados`.
- **Transparencia para el Usuario:**
  - `GET /api/user/audit/deleted-records`: Permite al usuario final consultar en cualquier momento todas las tarjetas dadas de baja, sustituciones y motivos que le afecten.
- **Auditoría para el Administrador:**
  - `GET /api/admin/audit/deleted-records`: Reporte exhaustivo de todas las bajas lógicas ejecutadas en el sistema.

---

## 4. Guía de Ejecución y Pruebas
### Levantar el servidor Backend:
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
### Ejecutar suite de pruebas automatizadas:
```bash
pytest backend/tests/ -v
```

---

## 5. Estrategia Multiagente GitFlow
Para salvaguardar la rama de producción (`main`), todos los desarrolladores y agentes de IA asignados a la lógica del backend deben operar en su rama delegada:

- **Rama Asignada:** `feature/backend-core`
- **Reglas de Aislamiento:**
  1. No realizar commits directos en `main`.
  2. Todos los endpoints deben documentar esquemas Pydantic para Request/Response.
  3. No alterar la interfaz del módulo `database/` sin coordinar con el agente de base de datos.
  4. Garantizar que todos los tests unitarios pasen al 100% antes de emitir Pull Request a `main`.
