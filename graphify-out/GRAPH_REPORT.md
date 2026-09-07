# Graph Report - Cajero Inzano prueba sexo duro aver que sale agentes de ia para trabajar  (2026-09-07)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 347 nodes · 647 edges · 30 communities (14 shown, 4 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `904dbf9b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- generate_totp_token
- WelcomeAuthView.tsx
- package.json
- LogAuditoria
- BankingService
- ArduinoSerialController
- compilerOptions
- TxtStorageManager
- compilerOptions
- user.py
- devDependencies
- hardware.py
- ConnectionManager
- .oxlintrc.json
- tsconfig.json
- Any
- Any
- Any

## God Nodes (most connected - your core abstractions)
1. `BankingService` - 40 edges
2. `Usuario` - 25 edges
3. `compilerOptions` - 18 edges
4. `LogAuditoria` - 17 edges
5. `TxtStorageManager` - 17 edges
6. `generate_totp_token()` - 17 edges
7. `compilerOptions` - 15 edges
8. `ArduinoSerialController` - 11 edges
9. `react` - 10 edges
10. `ArqueoCajero` - 9 edges

## Surprising Connections (you probably didn't know these)
- `BankingService` --uses--> `ArqueoCajero`  [INFERRED]
  backend/app/services/banking_service.py → database/models.py
- `BankingService` --uses--> `DenominacionCajero`  [INFERRED]
  backend/app/services/banking_service.py → database/models.py
- `BankingService` --uses--> `LogAuditoria`  [INFERRED]
  backend/app/services/banking_service.py → database/models.py
- `BankingService` --uses--> `RegistroEliminado`  [INFERRED]
  backend/app/services/banking_service.py → database/models.py
- `BankingService` --uses--> `Tarjeta`  [INFERRED]
  backend/app/services/banking_service.py → database/models.py

## Import Cycles
- None detected.

## Communities (30 total, 4 thin omitted)

### Community 0 - "generate_totp_token"
Cohesion: 0.06
Nodes (43): get_token_preview(), login(), LoginRequest, BaseModel, get, post, Session, Endpoint de conveniencia para visualizar el token dinámico de seguridad actual… (+35 more)

### Community 1 - "WelcomeAuthView.tsx"
Cohesion: 0.09
Nodes (28): App(), HardwareBadges(), HardwareBadgesProps, BILL_CONFIGS, BillConfig, QuetzalBillCard(), QuetzalBillCardProps, VirtualKeypad() (+20 more)

### Community 2 - "package.json"
Cohesion: 0.06
Nodes (32): { app, BrowserWindow, ipcMain }, fs, path, { contextBridge, ipcRenderer }, dependencies, react, react-dom, main (+24 more)

### Community 3 - "LogAuditoria"
Cohesion: 0.16
Nodes (18): get_pin_hash(), Generates deterministic salted SHA-256 hash for 4-digit PIN., Secure PIN comparison using constant-time comparison against salted hash.…, verify_pin(), Any, Session, Ejecuta baja lógica estricta sin destrucción de registros (Soft Delete). Marca…, Base (+10 more)

### Community 4 - "BankingService"
Cohesion: 0.17
Nodes (26): add_cash_vault(), adjust_limit(), AdjustLimitRequest, get_all_deleted_records(), get_metrics(), initialize_vault(), BaseModel, get (+18 more)

### Community 5 - "ArduinoSerialController"
Cohesion: 0.13
Nodes (9): ESP32Controller, Any, Simula o captura la fotografía de auditoría de la cámara OV2640., Controlador para ESP32-CAM (cámara OV2640) y Sensor Ultrasónico HC-SR04. Provee…, ArduinoSerialController, Any, Controlador de comunicación USB-Serial a 115200 baudios con Arduino Mega 2560…, Envía la trama JSON de dispensación y espera la confirmación de eyección por… (+1 more)

### Community 6 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 7 - "TxtStorageManager"
Cohesion: 0.20
Nodes (6): Any, Session, Extrae directamente de transacciones_historico.txt las últimas transacciones…, Gestor del patrón Dual-Write Concurrente para archivos de texto plano…, TxtStorageManager, datetime

### Community 8 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 9 - "user.py"
Cohesion: 0.24
Nodes (14): change_pin(), ChangePinRequest, deposit_money(), DepositRequest, get_my_deleted_records(), get_transactions(), BaseModel, get (+6 more)

### Community 10 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, autoprefixer, axios, electron, lucide-react, oxlint, postcss, tailwindcss (+6 more)

### Community 11 - "hardware.py"
Cohesion: 0.33
Nodes (8): DispenseTestRequest, get_hardware_status(), JamSimulationRequest, BaseModel, get, post, test_dispense(), toggle_jam()

### Community 12 - "ConnectionManager"
Cohesion: 0.36
Nodes (3): ConnectionManager, websocket_endpoint(), WebSocket

### Community 14 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

## Knowledge Gaps
- **92 isolated node(s):** `HardwareBadgesProps`, `VirtualKeypadProps`, `BillConfig`, `QuetzalBillCardProps`, `Window` (+87 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 154 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `BankingService` connect `BankingService` to `generate_totp_token`, `user.py`, `LogAuditoria`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `TxtStorageManager` connect `TxtStorageManager` to `LogAuditoria`, `BankingService`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `ArduinoSerialController` connect `ArduinoSerialController` to `generate_totp_token`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 22 inferred relationships involving `BankingService` (e.g. with `add_cash_vault()` and `adjust_limit()`) actually correct?**
  _`BankingService` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `Usuario` (e.g. with `add_cash_vault()` and `adjust_limit()`) actually correct?**
  _`Usuario` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `LogAuditoria` (e.g. with `BankingService` and `.admin_adjust_limit()`) actually correct?**
  _`LogAuditoria` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `TxtStorageManager` (e.g. with `DenominacionCajero` and `LogAuditoria`) actually correct?**
  _`TxtStorageManager` has 4 INFERRED edges - model-reasoned connections that need verification._