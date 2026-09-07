# Módulo de Frontend y Kiosco Táctil Embebido (`frontend/`)

## 1. Propósito e Importancia Crítica en el Sistema
El módulo `frontend/` constituye la única capa de interacción física y visual entre el cliente bancario/administrador y el cajero automático. 

### ¿Por qué es crítico?
- **Seguridad en Entrada de Datos:** Gestiona la captura segura de credenciales sensibles (PIN de 4 dígitos, tarjeta de 16 dígitos y tokens dinámicos TOTP de 6 dígitos) mediante un teclado numérico táctil en pantalla (Numpad) que evita keyloggers físicos o captura por hardware externo.
- **Validación Aritmética Reactiva:** En retiros con montos arbitrarios no estandarizados (ej. Q123.00, Q239.00), el frontend valida en tiempo real que la suma del vector de billetes coincida al céntimo con el monto escalar antes de despachar la petición a la red.
- **Tolerancia y Resiliencia en Kiosco:** Diseñado para operar 24/7 en terminales de autoservicio sin teclado físico ni mouse convencional, encapsulado en **Electron** con mecanismos de auto-recuperación, bloqueo de atajos de sistema y temporizador de cierre de sesión por inactividad (60 segundos).

---

## 2. Estructura de Archivos y Responsabilidad de Componentes

```
frontend/
├── electron/
│   ├── main.js                  # Proceso principal de Electron: gestión de ventana nativa (Kiosk / Ventana), IPC y controles.
│   └── preload.js               # Puente de contexto seguro (ContextBridge) para exponer APIs del sistema al renderer.
├── src/
│   ├── components/
│   │   ├── Numpad.tsx           # Teclado táctil en pantalla con respuesta sonora/háptica y mezcla de dígitos opcional.
│   │   ├── QuetzalBillCard.tsx  # Tarjeta interactiva con visual de denominaciones de Quetzales (Q200, Q100, Q50, Q20, Q10, Q5, Q1).
│   │   ├── WindowBar.tsx        # Barra de control personalizada para alternar entre pantalla completa y modo ventana en pruebas.
│   │   └── VaultStatusBadge.tsx # Indicador visual del estado de los sensores y stock de la bóveda.
│   ├── views/
│   │   ├── LoginView.tsx        # Pantalla de autenticación bancaria de doble factor (Tarjeta + PIN + TOTP).
│   │   ├── UserDashboardView.tsx# Panel del usuario: retiros no estandarizados, depósitos, cambio de PIN y auditoría de bajas.
│   │   └── AdminConsoleView.tsx # Consola del administrador: arqueo inicial (Q10k), recargas (Q30k), auditoría y hardware.
│   ├── services/
│   │   ├── api.ts               # Cliente HTTP Axios configurado con interceptor JWT y timeout de 10s.
│   │   └── websocket.ts         # Conexión WebSocket al backend (`/ws/hardware`) para telemetría en tiempo real.
│   ├── App.tsx                  # Enrutador principal de estados de autenticación y renderizado de vistas.
│   ├── index.css                # Configuración de Tailwind CSS con paleta oscura Discord (Blurple, Dark Theme, Emerald).
│   └── main.tsx                 # Punto de entrada React 18 con StrictMode montado en root del DOM.
├── index.html                   # HTML base con meta-etiquetas de viewport móvil para kiosco táctil.
├── vite.config.ts               # Configuración de bundling rápido con Vite, proxy HTTP hacia backend y hot reload.
├── tsconfig.json                # Reglas estrictas de compilación TypeScript.
└── package.json                 # Dependencias: React 18, Lucide-React, Axios, TailwindCSS, Electron.
```

---

## 3. Especificaciones Técnicas y Patrones de Diseño

### 3.1 Estética Visual Discord Dark Mode
La interfaz implementa un tema oscuro modular de alta legibilidad en pantallas táctiles industriales:
- **Fondo Primario:** `#202225` (Gris profundo Discord).
- **Superficie de Tarjetas:** `#2F3136` con bordes `#36393F`.
- **Acento Primario (Blurple):** `#5865F2` para acciones principales de retiro y foco.
- **Acento Positivo (Verde Esmeralda):** `#57F287` para confirmaciones contables y saldos.
- **Acento Advertencia (Ámbar):** `#FEE75C` para alertas de límite diario y cambio de PIN.
- **Acento Crítico (Rojo):** `#ED4245` para bloqueos, rechazos y cierre de sesión.

### 3.2 Desglose Ávido (Greedy Algorithm) en Retiros
Para cantidades no múltiplos de 100 (ej. Q123.00), el algoritmo implementado en `UserDashboardView.tsx` selecciona dinámicamente:
$$\text{Remanente} = Q123 \longrightarrow 1 \times Q100 + 1 \times Q20 + 3 \times Q1$$
contrastando contra el inventario disponible de cada cartucho en tiempo real.

### 3.3 Visualización Transparente de Bajas (*Soft Delete*)
La pestaña **Mis Registros y Bajas** consume el endpoint `GET /api/user/audit/deleted-records`. Presenta al usuario los plásticos anteriores dados de baja, el motivo formal de sustitución y el ID de autorización, cumpliendo con la normativa de transparencia financiera.

---

## 4. Guía Operativa de Ejecución y Compilación

### Instalación de Dependencias:
```bash
cd frontend
npm install
```

### Ejecución en Modo Desarrollo (Vite HMR):
```bash
npm run dev
```
Acceso en navegador: `http://localhost:5173`.

### Compilación Estricta de Producción:
```bash
npm run build
```
Genera los binarios optimizados en `dist/`.

### Lanzar Aplicación en Kiosco Nativo (Electron):
```bash
npm run electron:start
```

---

## 5. Directrices para el Agente de IA (`feature/frontend-kiosk`)

- **Rama Exclusiva:** `feature/frontend-kiosk` (prohibido hacer push directo a `main`).
- **Validación Obligatoria:** Ejecutar siempre `npm run build` localmente antes de proponer un Pull Request.
- **Regla de Tipos:** Todo nuevo campo o respuesta de API debe tiparse estrictamente en `src/services/api.ts` reflejando los esquemas Pydantic del backend.
- **Ergonomía Táctil:** Los botones deben mantener un área de impacto mínima de 48x48 píxeles con retroalimentación visual (`active:scale-95`).
