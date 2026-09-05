# Documento de Análisis y Diseño: Matrices de Entradas, Procesos y Salidas (E-P-S)

## Sistema Bancario y Cajero Automático Embebido (Kiosco Discord-Style)

Este documento formaliza la ingeniería de requerimientos del sistema conforme a la rúbrica de evaluación académica, detallando de manera rigurosa las entradas de datos, las reglas de negocio y validación transaccional, y las salidas físicas, digitales y de persistencia dual.

---

### 1. Matriz General de Operaciones (E-P-S)

| Operación | Entradas (E) | Procesos y Reglas de Validación (P) | Salidas (S) |
| :--- | :--- | :--- | :--- |
| **Autenticación Multifactor (Modo Dual)** | 1. Rol objetivo (Usuario / Administrador).<br>2. Tarjeta (16 dígitos numéricos).<br>3. PIN confidencial (4 dígitos numéricos).<br>4. Token temporal dinámico (6 dígitos TOTP). | 1. Validación de formato de tarjeta (16 dígitos).<br>2. Búsqueda de cuenta activa en base de datos.<br>3. Verificación de hash criptográfico de PIN.<br>4. Validación de ventana temporal de token TOTP (60 segundos).<br>5. Verificación de permisos de rol.<br>6. Registro de estampa de tiempo de acceso (`fecha_ultimo_acceso`). | 1. Token JWT de sesión segura.<br>2. Redirección a Vista 2 (Usuario) o Vista 3 (Administrador).<br>3. Despliegue de datos de cuenta y saldo contable.<br>4. Notificación visual en caso de error. |
| **Retiro Personalizado (Montos No Estándar)** | 1. Identificador de usuario autenticado.<br>2. Monto escalar arbitrario (ej. Q123.00, Q239.00).<br>3. Vector de billetes desglosados $\{200, 100, 50, 20, 10, 5, 1\}$. | 1. Verificación de saldo suficiente: $\text{saldo\_actual} \ge \text{monto}$.<br>2. Verificación de cupo diario: $\text{total\_retirado\_hoy} + \text{monto} \le \text{monto\_max\_diario}$.<br>3. Consistencia aritmética estricta: $\sum (d_i \times c_i) = \text{monto}$.<br>4. Verificación de existencias físicas en bóveda: $\text{stock\_boveda}[d_i] \ge c_i$.<br>5. Envío de comando serie `DISPENSE` a Arduino Mega 2560.<br>6. Si Arduino reporta `JAM_DETECTED`, cancelación total sin débitos contables.<br>7. Si confirma `SUCCESS`, débito atómico de saldo e incremento de retirado diario.<br>8. Reducción de inventario en cartuchos físicos. | 1. Dispensación física de billetes por los motores paso a paso.<br>2. Comprobante digital en pantalla con nuevo saldo contable.<br>3. Registro en tabla `transacciones` y `logs_auditoria` (DB).<br>4. Captura fotográfica de seguridad con ESP32-CAM.<br>5. Persistencia dual atómica en `usuarios.txt`, `cajero_inventario.txt`, `transacciones_historico.txt` y `auditoria_eventos.txt`. |
| **Depósito Desglosado** | 1. Identificador de usuario autenticado.<br>2. Vector de billetes introducidos $\{200, 100, 50, 20, 10, 5, 1\}$. | 1. Cálculo del monto total a acreditar: $\sum (d_i \times c_i)$.<br>2. Verificación de que el total sea mayor a cero.<br>3. Verificación de que el saldo consolidado en bóveda no supere el tope de Q30,000.00.<br>4. Acreditación atómica al saldo del cliente.<br>5. Incremento de inventario en bóveda. | 1. Saldo contable actualizado en tiempo real.<br>2. Comprobante digital de depósito.<br>3. Registro en base de datos y persistencia dual en los archivos planos delimitados por plecas. |
| **Consulta de Saldo y Cupo Remanente** | 1. Identificador de usuario autenticado. | 1. Lectura del saldo contable actual.<br>2. Cálculo de cupo remanente: $\max(0, \text{monto\_max\_diario} - \text{total\_retirado\_hoy})$.<br>3. Cálculo de porcentaje de cupo consumido. | 1. Tarjeta visual de saldo en Quetzales (Q.).<br>2. Anillo circular reactivo con porcentaje y advertencia en color ámbar/rojo según proximidad al límite. |
| **Actualización de PIN Confidencial** | 1. Identificador de usuario.<br>2. Número de tarjeta plástica activa.<br>3. PIN actual de 4 dígitos.<br>4. Token dinámico de 6 dígitos.<br>5. Nuevo PIN confidencial de 4 dígitos. | 1. Validación de longitud y formato numérico del nuevo PIN (4 dígitos).<br>2. Verificación de coincidencia de tarjeta.<br>3. Verificación de PIN actual.<br>4. Validación de token TOTP.<br>5. Generación de nuevo hash salted.<br>6. Actualización del indicador `cambio_pin_realizado = true`. | 1. Notificación visual de cambio exitoso.<br>2. Actualización de hash en DB y en `usuarios.txt`.<br>3. Registro en bitácora de auditoría. |
| **Inicialización Diaria de Bóveda** | 1. Credenciales de Administrador.<br>2. Conteo de billetes por denominación para arranque de jornada. | 1. Verificación estricta de permisos de administrador.<br>2. Cálculo del monto inicial consolidado: $\sum (d_i \times c_i)$.<br>3. Validación de límite estricto: $\text{monto\_total} \le \text{Q10,000.00}$.<br>4. Asignación de stock a cartuchos de bóveda.<br>5. Reinicio de consumos diarios (`total_retirado_hoy = 0.00`) para todos los usuarios. | 1. Estado de bóveda habilitado ("Inicializado").<br>2. Registro de evento `INICIALIZACION` en tabla `arqueos_cajero`.<br>3. Actualización de primera línea de `cajero_inventario.txt`.<br>4. Sincronización completa de `usuarios.txt`. |
| **Adición de Efectivo (Recarga)** | 1. Credenciales de Administrador.<br>2. Lote adicional de billetes por denominación. | 1. Validación de inicialización previa de bóveda.<br>2. Cálculo del saldo consolidado proyectado: $\text{saldo\_actual\_boveda} + \text{nuevo\_lote}$.<br>3. Validación de tope máximo: $\text{saldo\_proyectado} \le \text{Q30,000.00}$.<br>4. Suma de piezas a los cartuchos de denominación. | 1. Notificación de recarga exitosa.<br>2. Registro de evento `RECARGA` en `arqueos_cajero`.<br>3. Actualización de existencias en DB y `cajero_inventario.txt`. |
| **Reasignación de Plástico de Tarjeta** | 1. Credenciales de Administrador.<br>2. ID de usuario a modificar.<br>3. Nuevo número de tarjeta (16 dígitos numéricos). | 1. Validación de formato de 16 dígitos.<br>2. Comprobación de unicidad en el sistema.<br>3. Desactivación del plástico anterior.<br>4. Creación o activación del nuevo registro de tarjeta asociado al usuario.<br>5. **Preservación intacta** del saldo contable y consumos acumulados del día. | 1. Tarjeta actualizada en catálogo maestro.<br>2. Notificación en consola de administración.<br>3. Persistencia en base de datos y `usuarios.txt`.<br>4. Entrada en `auditoria_eventos.txt`. |
| **Ajuste de Límite Diario** | 1. Credenciales de Administrador.<br>2. ID de usuario.<br>3. Nuevo monto máximo diario de retiro. | 1. Validación de monto positivo.<br>2. Modificación de campo `monto_max_diario` del usuario.<br>3. Recálculo automático de cupo disponible. | 1. Límite actualizado en DB y en `usuarios.txt`.<br>2. Registro de auditoría con valor anterior y nuevo. |
| **Métricas y Auditoría Diaria** | 1. Credenciales de Administrador.<br>2. Solicitud de panel de control. | 1. Agregación contable de retiros efectuados hoy por todos los usuarios ($\sum \text{total\_retirado\_hoy}$).<br>2. Cálculo de promedio de depósitos realizados.<br>3. Conteo de usuarios que han cambiado PIN.<br>4. Determinación del último usuario conectado con su estampa de tiempo completa.<br>5. Extracción de los últimos eventos de auditoría. | 1. Despliegue de los 4 KPI cards superiores.<br>2. Tabla detallada de usuarios y estado de plásticos.<br>3. Bitácora cronológica de eventos de auditoría. |

---

### 2. Estructura de Persistencia Dual en Archivos Planos (.txt)

Cada movimiento financiero u operativo actualiza síncronamente los archivos ubicados en `./data/storage_txt/`:

1. **`usuarios.txt`**
   - Formato: `ID_USUARIO|NOMBRE_COMPLETO|TARJETA_ACTUAL|PIN_HASH|SALDO_ACTUAL|MONTO_MAX_DIARIO|TOTAL_RETIRADO_HOY|CAMBIO_PIN|ULTIMO_ACCESO`
   - Delimitador: Pleca (`|`)
   - Propósito: Catálogo maestro de clientes, saldos contables y límites diarios.

2. **`cajero_inventario.txt`**
   - Primera línea (Encabezado de Control): `TOTAL_BOVEDA|{monto_consolidado}`
   - Líneas subsiguientes: `DENOMINACION|CANTIDAD_BILLETES|SUBTOTAL`
   - Propósito: Monitoreo estricto del límite máximo de Q30,000.00 y stock por cartucho.

3. **`transacciones_historico.txt`**
   - Formato: `ID_TX|TIMESTAMP|ID_USUARIO|TIPO|MONTO|DESGLOSE_JSON`
   - Propósito: Registro secuencial e inmutable; de este archivo se extraen de forma directa las últimas 5 transacciones de cada usuario en el kiosco.

4. **`auditoria_eventos.txt`**
   - Formato: `ID_LOG|TIMESTAMP|ID_USUARIO|ACCION|DETALLES`
   - Propósito: Bitácora integral forense de seguridad bancaria.
