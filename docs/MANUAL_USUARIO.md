# Manual de Usuario: Guía Paso a Paso para la Terminal de Autoservicio

## Sistema Bancario y Cajero Automático Embebido (ATM Kiosk)

Bienvenido a la guía operativa de la terminal de autoservicio bancario. La interfaz ha sido diseñada con ergonomía táctil de kiosco de pantalla completa y una estética moderna inspirada en Discord (modo oscuro profundo, tarjetas modulares con bordes redondeados y microinteracciones de alta respuesta).

---

## PARTE 1: GUÍA PARA EL USUARIO (ÁREA DE AUTOSERVICIO)

### 1. Inicio de Sesión Multifactor (Vista 1)
1. **Selección de Modo:** Verifique que el conmutador superior se encuentre en **"Terminal Usuario"** (botón azul con icono de usuario).
2. **Ingreso de Tarjeta:** Toque el campo "Número de Tarjeta" e ingrese los 16 dígitos numéricos utilizando el teclado táctil virtual en pantalla. Los dígitos se agruparán automáticamente en bloques de cuatro (`XXXX-XXXX-XXXX-XXXX`).
3. **Ingreso de PIN:** Toque el campo "PIN" e introduzca su clave de 4 dígitos. Por seguridad, los dígitos se mostrarán enmascarados con puntos circulares.
4. **Ingreso de Token:** Ingrese el código temporal numérico de 6 dígitos (TOTP). En la pantalla del kiosco se muestra un recuadro con el token dinámico de seguridad vigente para facilitar la prueba.
5. **Confirmación:** Toque el botón **"Entrar"** (color verde `#57F287`) en el teclado virtual para acceder a su cuenta.

> [!TIP]
> Si comete un error, presione el botón **"Limpiar"** (color rojo `#ED4245`) para vaciar el campo activo.
> En la esquina inferior izquierda se encuentran botones de acceso rápido para iniciar sesión con usuarios de prueba con un solo toque (ej. *Carlos Gómez*, *María López*, *Juan Pérez*).

---

### 2. Retiro Personalizado con Desglose de Billetes (Vista 2)
Una de las características distintivas de este cajero es la capacidad de dispensar montos arbitrarios no estandarizados (como **Q123.00** o **Q239.00**):

1. **Definir Monto:**
   - En la columna central, introduzca el monto exacto deseado en el campo numérico (ej. `123`).
   - También puede tocar los botones de acceso rápido como `⚡ Q123.00` o `⚡ Q239.00`.
2. **Seleccionar Desglose de Billetes:**
   - En la cuadrícula de 7 denominaciones oficiales en Quetzales (**Q200, Q100, Q50, Q20, Q10, Q5, Q1**), use los botones táctiles **`+`** y **`-`** para armar el lote de billetes.
   - *Ejemplo para Q123.00:*
     - 1 billete de Q100
     - 1 billete de Q20
     - 3 billetes de Q1
     - $\text{Total}: (1 \times 100) + (1 \times 20) + (3 \times 1) = \text{Q123.00}$.
3. **Validación Reactiva:**
   - En la columna derecha, observe la tarjeta de cálculo:
     - Si la suma coincide exactamente, el recuadro se iluminará en **verde** mostrando *"Suma Exacta: Válido"*.
     - Si no coincide, se mostrará en **rojo** con la diferencia en Quetzales.
4. **Dispensación:**
   - Una vez la suma sea exacta, el botón **"Dispensar Efectivo"** se habilitará en verde brillante.
   - Presione el botón: los motores paso a paso del cajero extraerán físicamente las piezas, los sensores ópticos comprobarán la salida del papel moneda y el saldo contable se actualizará en tiempo real.

---

### 3. Depósito de Efectivo Desglosado
1. En el menú lateral izquierdo, seleccione la pestaña **"Depósito Desglosado"**.
2. Introduzca el detalle de piezas por denominación utilizando los controles táctiles `+` y `-`.
3. Verifique el monto total acumulado a acreditar en el panel inferior.
4. Presione **"Confirmar Depósito"**: sus fondos se acreditarán de inmediato y los billetes se sumarán a la bóveda física del cajero.

---

### 4. Consulta de Saldo y Cupo Remanente Diario
* En la columna izquierda, visualice su **Saldo Contable Disponible** en Quetzales.
* El **Anillo Circular de Cupo Diario** le indicará visualmente qué porcentaje del límite diario permitido ha consumido durante la jornada, detallando el monto retirado hoy y el cupo disponible restante.

---

### 5. Historial de Transacciones
* En la columna derecha, la tabla de auditoría personal despliega las **últimas 5 transacciones** efectuadas en el cajero (fecha, hora, tipo: Retiro o Depósito, y monto exacto), leídas directamente del archivo histórico `transacciones_historico.txt`.

---

### 6. Actualización de PIN Confidencial
1. Seleccione la pestaña **"Actualizar PIN"**.
2. Ingrese su PIN confidencial actual de 4 dígitos.
3. Ingrese el token dinámico de 6 dígitos.
4. Digite su nuevo PIN de 4 dígitos y presione **"Confirmar Nuevo PIN"**.

---

### 7. Temporizador de Inactividad y Salida Segura
* Para salvaguardar la privacidad bancaria, la terminal cuenta con un **temporizador automático de inactividad de 60 segundos** en la esquina superior derecha. Si no se detecta interacción táctil, la sesión se cerrará automáticamente.
* Puede cerrar su sesión en cualquier momento presionando el botón **"Cerrar Sesión"**.

---

## PARTE 2: GUÍA PARA EL ADMINISTRADOR (CONSOLA BANCARIA)

### 1. Acceso a la Consola Administrativa
1. En la pantalla de bienvenida, cambie el conmutador superior a **"Panel Administrador"** (botón ámbar con icono de candado).
2. Ingrese la tarjeta del administrador (`9999-8888-7777-6666`), el PIN (`1234`) y el token dinámico.
3. Presione **"Entrar"**.

---

### 2. Barra de KPIs Superiores
* **Saldo en Bóveda:** Indicador de fondos físicos acumulados con barra de capacidad proporcional al límite máximo permitido de **Q30,000.00**.
* **Total Retirado Hoy por Todos:** Suma consolidada de extracciones realizadas por los clientes durante el día.
* **Promedio de Depósitos:** Ticket promedio de depósitos registrados.
* **Estado de Bóveda:** Notifica si el cajero ha sido inicializado para la jornada operativa o si se encuentra pendiente.

---

### 3. Módulo de Bóveda y Arqueo
* **Inventario en Cartuchos:** Visualización en tiempo real de la cantidad de piezas y subtotales por denominación (Q200 a Q1).
* **Inicialización Diaria:**
  - Ingrese el conteo de billetes al iniciar la jornada.
  - El sistema valida estrictamente que el valor total consolidado **no sobrepase los Q10,000.00**.
  - Al inicializar, se reinician los consumos diarios acumulados de los usuarios a cero.
* **Agregar Efectivo (Recarga):**
  - Permite recargar piezas adicionales durante el día.
  - La operación exige inicialización previa y **bloquea el ingreso** si el saldo total acumulado en la terminal superaría el límite de **Q30,000.00**.

---

### 4. Módulo de Cuentas de Usuarios
* **Tabla de Empleados:** Muestra ID, nombre, tarjeta de 16 posiciones, saldo contable, límite diario, total retirado hoy, último acceso y estado de cambio de PIN.
* **Modificar Límite:** Permite ajustar el tope máximo de retiro diario permitido para un empleado.
* **Reasignar Plástico:** Modifica el número de tarjeta plástica de 16 dígitos asignado al usuario, **preservando íntegramente** su saldo contable y su historial de extracciones acumuladas del día.
* **Registrar Nuevo Empleado:** Formulario para dar de alta un nuevo trabajador con tarjeta única, PIN inicial, saldo contable y límite diario.

---

### 5. Bitácora de Auditoría y Telemetría de Hardware
* **Bitácora de Auditoría:** Lista secuencial e inmutable de eventos (`auditoria_eventos.txt`), incluyendo inicializaciones, recargas, retiros, depósitos y cambios de PIN.
* **Telemetría Hardware:**
  - Estado del enlace serie con Arduino Mega 2560 (115200 baudios).
  - Estado de la cámara ESP32-CAM y sensor ultrasónico de presencia HC-SR04.
  - **Interruptor de Prueba de Atasco:** Permite activar la simulación de atasco mecánico (`JAM_DETECTED`) para verificar en vivo cómo el backend cancela la operación y protege las cuentas bancarias de los clientes.
