# Manual de Usuario: Terminal de Autoservicio y Consola Administrativa

## Sistema Bancario y Cajero Automático Embebido (ATM Kiosk) - Versión 2.3.0
### Red Multicajero, Red Interbancaria TCP 5000 y Sincronización Tripartita

---

Bienvenido al manual operativo integral del sistema bancario **Banco Nacional Inzano GYT**. Esta guía cubre paso a paso la operación en la terminal táctil de autoservicio para clientes, la administración local de cajeros independientes, la consola global de superadministración de red multicajero y la sincronización con el servidor central en línea.

---

## PARTE 1: GUÍA PARA EL USUARIO (TERMINAL DE AUTOSERVICIO)

### 1. Barra de Accesibilidad y Ergonomía
En el borde superior de la terminal se encuentra la **Barra de Accesibilidad** interactiva, diseñada para garantizar una experiencia inclusiva, ergonómica y tolerante a fallos:

* **🌓 Modo Alto Contraste:** Conmute este botón para activar una paleta de ultra-contraste (fondo negro puro, bordes y acentos amarillo reflectivo `#FFD700` y textos blancos brillantes), certificada bajo lineamientos WCAG AAA.
* **🔠 Zoom de Fuente:** Presione el botón **"A+"** para aumentar el tamaño de textos y números en toda la pantalla, ideal para personas con baja agudeza visual.
* **⌨️ Teclado Numérico Virtual Flotante (PINPad):** Si utiliza una pantalla táctil o prefiere teclear mediante cursor, pulse este icono para desplegar el PINPad flotante reubicable.
* **🔍 Consultar Operación Pendiente:** Si ocurrió un apagón eléctrico, falla mecánica o desconexión de red mientras realizaba un retiro o transferencia, toque este botón e introduzca el número de referencia o token (`TRF-...`). El sistema comprobará el estado real de la transacción en el servidor sin duplicar débitos.
* **🔇 Asistencia Sonora Silenciada:** Los beeps auditivos han sido desactivados para garantizar máxima discreción y privacidad en espacios públicos y oficinas bancarias.

---

### 2. Inicio de Sesión Multifactor (Vista 1)

1. **Identificación y Cambio del Cajero Activo:** En el encabezado observe el nombre y código del cajero en el que está operando (por ejemplo, `ATM-004: Cajero ATM 4 - Sucursal Inzano`).
   * **Botón `[ 🔄 Cambiar Cajero ]`:** Permite conmutar entre los cajeros disponibles de la red (`ATM-001` a `ATM-004`) o registrar uno nuevo directamente ingresando su código de seguridad (ej. `000` para ATM-004 o `1234`).
   * **Botón `[ ☁️ Sincronizar Nube ]`:** Conecta de inmediato con el servidor en línea (Render) para descargar y subir las transacciones pendientes sin perder información ante reinicios.
2. **Ingreso de Tarjeta:** Toque el campo "Número de Tarjeta" e ingrese los 16 dígitos numéricos. La interfaz agrupa los números en bloques legibles de 4 (`XXXX-XXXX-XXXX-XXXX`).
3. **Ingreso de PIN Confidencial con Visor Seguro:**
   * Toque el campo "PIN" e introduzca sus 4 dígitos.
   * **Botón de Ojo (Mostrar/Ocultar):** Si necesita verificar visualmente los dígitos ingresados, presione el icono del ojo (`👁️`) a la derecha del campo para alternar entre puntos enmascarados y números visibles.
4. **Ingreso de Token Dinámico:** Ingrese el código numérico de 6 dígitos (TOTP). En la pantalla del kiosco se exhibe el recuadro con el token vigente para agilizar el ingreso. Dispone además de tolerancia de tiempo extendida para prevenir bloqueos involuntarios.
5. **Confirmación:** Presione el botón verde **"Entrar"** en el teclado virtual.

> [!TIP]
> **Accesos Rápidos de Demostración:** En la esquina inferior izquierda dispone de botones de prueba rápida para iniciar sesión con un solo toque como *Carlos Roberto Gómez*, *María Andrea López*, *Juan Fernando Pérez*, *Sofía Morales* o *Diego Ruiz*.

---

### 3. Retiro de Efectivo y Desglose Inteligente (Vista 2)

El sistema combina rapidez de dispensación con control absoluto sobre la denominación de billetes a recibir:

1. **Definir Monto del Retiro:**
   * **Accesos Rápidos Estándar:** Toque **`Q50`**, **`Q100`**, **`Q200`**, **`Q500`** o **`Q1000`**.
   * **Monto Manual Arbitrario:** Digite cualquier valor exacto (ej. `Q123.00`, `Q235.00`, etc.).
2. **Armado del Desglose por Denominación:**
   * En la cuadrícula táctil de 7 denominaciones oficiales guatemaltecas (**Q200, Q100, Q50, Q20, Q10, Q5, Q1**), use los botones **`+`** y **`-`** para configurar el lote exacto de billetes.
   * O presione **"⚡ Desglose Automático"** para que el algoritmo determine la combinación óptima de billetes con la menor cantidad de piezas.
3. **Propuesta de Desglose Alternativo ante Falta de Stock (Novedad v2.2.0):**
   * Si la bóveda física de este cajero no dispone de suficientes billetes de la denominación que usted eligió, pero el cajero sí tiene fondos suficientes en otros billetes, el sistema no rechazará su retiro.
   * Aparecerá una sugerencia en pantalla con el desglose exacto que el cajero sí puede entregar, junto al botón **"Aceptar Desglose Propuesto"**. Al tocarlo, el lote se cargará automáticamente.
4. **Validación Reactiva y Dispensación:**
   * Cuando la suma coincida exactamente con el monto solicitado, el recuadro se iluminará en **verde** (*"Suma Exacta: Válido"*).
   * Presione **"Dispensar Efectivo"**: los motores paso a paso dispensarán las piezas, los sensores ópticos comprobarán la salida y se emitirá el recibo digital con su nuevo saldo.

---

### 4. Módulo de Depósitos y Transferencias

El módulo de depósitos ofrece tres alternativas accesibles desde el menú o las pestañas de autoservicio:

#### 4.1 Depósito a Cuenta Propia
1. Seleccione la opción **"Cuenta Propia"**.
2. Utilice los botones de carga rápida (`+Q50`, `+Q100`, `+Q200`, `+Q500`, `+Q1000`) o los selectores `+`/`-` para contar los billetes a depositar en el cajero.
3. El panel reactivo calculará el valor total y el nuevo saldo proyectado.
4. Presione **"Confirmar Depósito"** para acreditar inmediatamente el saldo a su cuenta e incrementar el efectivo de la bóveda del cajero.

#### 4.2 Depósito a Cuentas de Terceros (Cuenta de 8 Dígitos)
1. Seleccione la opción **"A Terceros (Mismo Banco)"**.
2. Ingrese el **ID de Cuenta Bancaria de 8 Dígitos** del destinatario (por ejemplo `20027819` perteneciente a María Andrea López).
3. El cajero consultará en tiempo real el catálogo de cuentas y mostrará el **Nombre del Titular** para confirmación visual, protegiéndolo de envíos erróneos.
4. Desglose los billetes físicos a depositar en la terminal.
5. Presione **"Confirmar Depósito a Tercero"**. Los fondos se acreditarán en la cuenta del destinatario y se emitirá un comprobante con el nombre del receptor y la referencia contable.

#### 4.3 Transferencia Interbancaria en Red Local (TCP 5000 / UDP 5005)
1. Seleccione la opción **"Transferencia Interbancaria"**.
2. Seleccione el **Banco Destino** de la lista de bancos descubiertos en la red local (ej. `NETGEAR Interbank`, `NEXUSBANK - BANC01`).
3. Ingrese el número de cuenta de 8 dígitos del destinatario en dicho banco.
4. El sistema verificará la existencia de la cuenta en el banco vecino mediante el comando `IB_VERIFICAR_CUENTA`.
5. Digite el monto a transferir y presione **"Enviar Transferencia"**.
6. El sistema enviará la solicitud `IB_TRANSFERIR` con un token único `TRF-YYYYMMDD-HHMMSS` emitido por **`Banco Nacional Inzano GYT` (`BANC02`)**.
7. Se emitirá su factura con el token de confirmación interbancaria.

---

### 5. Actualización de PIN Confidencial con Triple Validación (Novedad v2.2.0)

Para blindar la cuenta ante errores involuntarios de tipeo:
1. Diríjase a la pestaña **"Actualizar PIN"**.
2. **PIN Actual:** Ingrese su clave confidencial de 4 dígitos en uso.
3. **Nuevo PIN:** Introduzca la nueva combinación de 4 dígitos.
4. **Confirmar Nuevo PIN:** Vuelva a escribir la nueva combinación. La interfaz comprobará en vivo que ambos campos coincidan antes de permitir el guardado.
5. **Token Dinámico:** Ingrese el código temporal de 6 dígitos.
6. Presione **"Confirmar Nuevo PIN"**.

---

### 6. Consulta de Saldo, Facturas Detalladas y Cupo Diario

* **Tarjeta de Saldos:** Muestra con total transparencia el saldo disponible de su cuenta y los fondos físicos totales en la bóveda de este cajero (`total_boveda`).
* **Anillo de Cupo Diario:** Barra circular que detalla cuánto ha retirado durante el día y el margen restante de su límite máximo.
* **Factura Detallada:** Todo comprobante de retiro, depósito o transferencia incluye fecha, hora, banco emisor (**Banco Nacional Inzano GYT**), cajero de origen, titular, destinatario (si aplica), desglose de billetes y token de seguimiento.

---

### 7. Temporizador de Seguridad con Alerta Temprana de 15 Segundos

* La terminal monitorea la inactividad durante un máximo de **60 segundos**.
* **Alerta Temprana (v2.2.0):** Al llegar a los **15 segundos restantes**, la pantalla oscurece suavemente el fondo y despliega una ventana modal con cuenta regresiva en color ámbar/rojo y un tono audible de aviso.
* Si toca cualquier parte de la pantalla o pulsa **"Continuar Sesión"**, el temporizador se reiniciará. De lo contrario, se cerrará la sesión de forma segura y se rotará el token de seguridad.

---

## PARTE 2: GUÍA PARA EL ADMINISTRADOR DE CAJERO INDIVIDUAL

### 1. Acceso a la Consola Administrativa
1. En la pantalla principal, cambie el selector a **"Panel Administrador"**.
2. Ingrese la tarjeta de administración (`9999-8888-7777-6666`), el PIN (`1234`) y el token dinámico.
3. Presione **"Entrar"**.

### 2. Gestión de Bóveda del Cajero Local
* **Inventario Exclusivo:** Toda la información de stock, arqueo y billetes corresponde únicamente a la bóveda física del cajero en el que se ha iniciado sesión.
* **Inicialización de Bóveda:** Al iniciar la jornada, introduzca la dotación inicial (límite máximo permitido de **Q10,000.00**).
* **Recarga de Efectivo:** Permite añadir billetes durante la jornada, validando que el acumulado en bóveda no supere el tope estructural de **Q30,000.00**.

### 3. Catálogo de Usuarios y Auditoría Local
* **Manejo de Empleados:** Creación de usuarios con ID de cuenta bancaria de 8 dígitos, asignación y reasignación de tarjetas de 16 dígitos, modificación de límites diarios y bajas lógicas reversibles.
* **Bitácora Filtrable:** Pestañas para aislar transacciones de Retiro, Depósito, Eventos de Sistema y Hardware (Arduino / ESP32-CAM).

---

## PARTE 3: GUÍA PARA EL SUPERADMINISTRADOR (RED MULTICAJERO GLOBAL)

### 1. Acceso Exclusivo de Superadministrador
* **Credenciales de Acceso:** Ingrese con la tarjeta exclusiva de Superadmin (`8888-8888-8888-8888`), PIN (`1234`) y Token dinámico (`888999`).
* *Nota de Seguridad:* Esta opción y panel no son visibles ni accesibles para los administradores de cajeros locales.

### 2. Panel de Control de Red Multicajero
* **Monitor de Estado en Tiempo Real:** Visualización en cuadrícula de todos los cajeros de la institución (`ATM-001`, `ATM-002`, `ATM-003`, etc.), mostrando:
  * Estado de Conexión: **En Línea** (verde) o **Apagado** (gris/rojo).
  * Saldo Físico en Bóveda por cada cajero.
  * Código de Seguridad de 4 dígitos registrado en el primer inicio.
  * Sesión activa y último latido recibido.
* **Inicialización en Lote ("Inicializar Todos los Cajeros"):** Botón de un solo clic que inicializa y habilita la totalidad de los cajeros de la red de forma simultánea.
* **Prevención de Sesión Simultánea:** Si un operador intenta abrir una sesión en un cajero que ya cuenta con una sesión abierta en otra terminal, el sistema bloqueará el ingreso con el mensaje de advertencia correspondiente.
* **Auditoría e Impresión Consolidada:** Despliega y permite imprimir el informe contable global con todas las entradas, salidas y transferencias realizadas en la institución bancaria durante la jornada.