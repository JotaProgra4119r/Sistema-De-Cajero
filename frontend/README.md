# Módulo de Frontend y Kiosco Táctil (Frontend Module)

## 1. Visión General de la Interfaz
El módulo `frontend/` implementa la experiencia interactiva táctil del cajero automático. Diseñado para operar como una terminal de kiosco embebida o como aplicación de escritorio nativa mediante **Electron**:
- **Framework Core:** React 18 con TypeScript y Vite.
- **Estilos Visuales:** Tailwind CSS con una cuidada paleta visual inspirada en el modo oscuro profundo de Discord (tarjetas modulares, micro-interacciones táctiles, acentos en Blurple, Verde esmeralda, Ámbar y Rojo).
- **Contenedor de Escritorio:** Electron (`electron/main.js` y `electron/preload.js`), configurado con controles de ventana para alternar entre modo pantalla completa (Kiosk Mode) y modo ventana para pruebas de desarrollo.

---

## 2. Vistas y Módulos de Usuario
1. **Pantalla de Acceso (Login Kiosk):**
   - Teclado numérico táctil interactivo (Numpad).
   - Ingreso de tarjeta de 16 dígitos, PIN confidencial de 4 dígitos y token dinámico TOTP de 6 dígitos con refresco en tiempo real.
2. **Panel de Usuario (User Dashboard):**
   - **Retiro Personalizado:** Permite al usuario solicitar montos arbitrarios no estandarizados (ej. Q123.00, Q239.00) mediante selección interactiva o desglose automático eficiente según las 7 denominaciones en Quetzales.
   - **Depósito Desglosado:** Inserción de billetes por denominación con validación de capacidad de bóveda.
   - **Actualización de PIN:** Cambio confidencial de contraseña con verificación de token TOTP.
   - **Historial Transparente de Bajas (Soft Delete):** Pestaña dedicada (*Mis Registros y Bajas*) donde el usuario puede consultar en cualquier momento plásticos sustituidos, bloqueos o registros desactivados asociados a su cuenta bancaria.
3. **Panel Administrativo (Admin Console):**
   - Arqueo e inicialización de bóveda (tope diario Q10,000.00).
   - Recarga de efectivo (tope acumulado Q30,000.00).
   - Registro de trabajadores corporativos y reasignación de tarjetas.
   - Auditoría de bajas lógicas y registros archivados.
   - Telemetría en vivo del hardware (sensores de bóveda, cámara ESP32 y atascos simulados).

---

## 3. Instrucciones de Compilación y Ejecución
### Modo Desarrollo Web:
```bash
cd frontend
npm run dev
```
Disponible en `http://localhost:5173`.

### Compilación para Producción:
```bash
cd frontend
npm run build
```

### Ejecución en Kiosco Nativo (Electron):
```bash
npm run electron:start
```

---

## 4. Estrategia Multiagente GitFlow
Para proteger la rama principal de producción (`main`), todos los desarrolladores y agentes de IA dedicados a UI/UX, componentes React y empaquetado Electron deben trabajar exclusivamente en su rama delegada:

- **Rama Asignada:** `feature/frontend-kiosk`
- **Reglas de Aislamiento:**
  1. No realizar commits directos en `main`.
  2. Todo nuevo componente debe ser responsivo y apto para resolución táctil de Kiosco (1920x1080 o pantallas táctiles industriales).
  3. Probar siempre la compilación estricta de TypeScript (`npm run build`) antes de abrir Pull Request hacia `main`.
  4. Mantener sincronizados los tipos de datos con los esquemas Pydantic del backend.
