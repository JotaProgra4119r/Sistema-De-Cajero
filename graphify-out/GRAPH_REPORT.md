# Graph Report - Cajero Inzano prueba sexo duro aver que sale agentes de ia para trabajar  (2026-09-05)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 306 nodes · 553 edges · 27 communities (14 shown, 1 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7e556162`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Usuario
- WelcomeAuthView.tsx
- package.json
- BankingService
- main.py
- compilerOptions
- hardware.py
- compilerOptions
- generate_totp_token
- devDependencies
- TxtStorageManager
- ConnectionManager
- .oxlintrc.json
- login
- tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `BankingService` - 32 edges
2. `Usuario` - 25 edges
3. `compilerOptions` - 18 edges
4. `LogAuditoria` - 15 edges
5. `compilerOptions` - 15 edges
6. `generate_totp_token()` - 14 edges
7. `TxtStorageManager` - 11 edges
8. `react` - 10 edges
9. `init_db()` - 9 edges
10. `DenominacionCajero` - 8 edges

## Surprising Connections (you probably didn't know these)
- `BankingService` --uses--> `Usuario`  [INFERRED]
  backend/app/services/banking_service.py → backend/app/db/models.py
- `TxtStorageManager` --uses--> `Usuario`  [INFERRED]
  backend/app/storage_txt/txt_manager.py → backend/app/db/models.py
- `TxtStorageManager` --uses--> `DenominacionCajero`  [INFERRED]
  backend/app/storage_txt/txt_manager.py → backend/app/db/models.py
- `add_cash_vault()` --uses--> `BankingService`  [INFERRED]
  backend/app/api/admin.py → backend/app/services/banking_service.py
- `adjust_limit()` --uses--> `BankingService`  [INFERRED]
  backend/app/api/admin.py → backend/app/services/banking_service.py

## Import Cycles
- None detected.

## Communities (27 total, 1 thin omitted)

### Community 0 - "Usuario"
Cohesion: 0.12
Nodes (36): add_cash_vault(), adjust_limit(), AdjustLimitRequest, get_metrics(), initialize_vault(), BaseModel, get, post (+28 more)

### Community 1 - "WelcomeAuthView.tsx"
Cohesion: 0.09
Nodes (28): App(), HardwareBadges(), HardwareBadgesProps, BILL_CONFIGS, BillConfig, QuetzalBillCard(), QuetzalBillCardProps, VirtualKeypad() (+20 more)

### Community 2 - "package.json"
Cohesion: 0.06
Nodes (32): { app, BrowserWindow, ipcMain }, fs, path, { contextBridge, ipcRenderer }, dependencies, react, react-dom, main (+24 more)

### Community 3 - "BankingService"
Cohesion: 0.21
Nodes (17): create_access_token(), get_pin_hash(), verify_pin(), verify_totp_token(), init_db(), ArqueoCajero, DenominacionCajero, LogAuditoria (+9 more)

### Community 4 - "main.py"
Cohesion: 0.13
Nodes (12): Config, Settings, ArduinoSerialController, Any, Envía la trama JSON de dispensación y espera la confirmación de eyección.…, Controlador de comunicación USB-Serial a 115200 baudios con Arduino Mega 2560…, favicon(), health_check() (+4 more)

### Community 5 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 6 - "hardware.py"
Cohesion: 0.15
Nodes (12): DispenseTestRequest, get_hardware_status(), JamSimulationRequest, BaseModel, get, post, test_dispense(), toggle_jam() (+4 more)

### Community 7 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 8 - "generate_totp_token"
Cohesion: 0.22
Nodes (14): get_token_preview(), get, Endpoint de conveniencia para visualizar el token dinámico de seguridad actual…, generate_totp_token(), setup_vault_stock(), test_admin_vault_rules(), test_custom_withdrawal_inconsistent_bills(), test_custom_withdrawal_q123() (+6 more)

### Community 9 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, autoprefixer, axios, electron, lucide-react, oxlint, postcss, tailwindcss (+6 more)

### Community 10 - "TxtStorageManager"
Cohesion: 0.15
Nodes (6): Any, Extrae directamente de transacciones_historico.txt las últimas transacciones…, Sincroniza el estado completo de la BD hacia los archivos planos., Actualiza el stock de denominaciones y recalcula la primera línea con el total…, Gestor del patrón Dual-Write Concurrente para archivos de texto plano…, TxtStorageManager

### Community 11 - "ConnectionManager"
Cohesion: 0.36
Nodes (3): ConnectionManager, websocket_endpoint(), WebSocket

### Community 13 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 14 - "login"
Cohesion: 0.40
Nodes (5): login(), LoginRequest, BaseModel, post, Session

## Knowledge Gaps
- **93 isolated node(s):** `HardwareBadgesProps`, `BillConfig`, `QuetzalBillCardProps`, `VirtualKeypadProps`, `Window` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 137 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `BankingService` connect `BankingService` to `Usuario`, `login`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `TxtStorageManager` connect `TxtStorageManager` to `Usuario`, `BankingService`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `Usuario` connect `Usuario` to `TxtStorageManager`, `BankingService`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `BankingService` (e.g. with `add_cash_vault()` and `adjust_limit()`) actually correct?**
  _`BankingService` has 17 INFERRED edges - model-reasoned connections that need verification._
- **Are the 15 inferred relationships involving `Usuario` (e.g. with `add_cash_vault()` and `adjust_limit()`) actually correct?**
  _`Usuario` has 15 INFERRED edges - model-reasoned connections that need verification._
- **What connects `HardwareBadgesProps`, `BillConfig`, `QuetzalBillCardProps` to the rest of the system?**
  _93 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Usuario` be split into smaller, more focused modules?**
  _Cohesion score 0.11707317073170732 - nodes in this community are weakly interconnected._