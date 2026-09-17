# Graph Report - Sistema-De-Cajero-1.0.2_Release  (2026-09-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 847 nodes · 1548 edges · 85 communities (36 shown, 22 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 116 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- BankingService
- backend/tests/test_hardening_and_agents.py
- swarm_manager.py
- backend/main.py
- ArduinoSerialController
- TxtStorageManager
- BankingService
- frontend/src/App.tsx
- modules/frontend/src/App.tsx
- backend/app/core/security.py
- generate_totp_token
- Usuario
- modules/backend/app/core/security.py
- compilerOptions
- compilerOptions
- modules/backend/app/api/user.py
- backend/app/api/user.py
- compilerOptions
- compilerOptions
- frontend/package.json
- modules/frontend/package.json
- backend/tests/test_dual_write.py
- devDependencies
- devDependencies
- get_token_preview
- build
- build
- scripts
- scripts
- frontend/.oxlintrc.json
- modules/frontend/.oxlintrc.json
- frontend/electron/main.cjs
- Settings
- modules/frontend/electron/main.cjs
- dependencies
- frontend/tsconfig.json
- linux/run_web.sh
- instalacion/run_web.sh
- dependencies
- modules/frontend/tsconfig.json
- frontend/electron/preload.cjs
- instalacion/docker-run.sh
- install_debian.sh
- linux/docker-run.sh
- install_linux.sh
- run_linux.sh
- run_debian.sh
- install.sh
- modules/frontend/electron/preload.cjs
- run_kiosk.sh
- run_web.sh
- Any
- Any
- Any
- Base
- BaseSettings
- fixture
- timedelta

## God Nodes (most connected - your core abstractions)
1. `BankingService` - 65 edges
2. `Usuario` - 49 edges
3. `generate_totp_token()` - 42 edges
4. `BankingService` - 23 edges
5. `DenominacionCajero` - 22 edges
6. `TxtStorageManager` - 20 edges
7. `TxtStorageManager` - 18 edges
8. `compilerOptions` - 18 edges
9. `compilerOptions` - 18 edges
10. `RegistroEliminado` - 17 edges

## Surprising Connections (you probably didn't know these)
- `get_current_admin()` --uses--> `Usuario`  [INFERRED]
  modules/backend/app/api/deps.py → database/models.py
- `BankingService` --uses--> `ArqueoCajero`  [INFERRED]
  backend/app/services/banking_service.py → database/models.py
- `BankingService` --uses--> `DenominacionCajero`  [INFERRED]
  backend/app/services/banking_service.py → database/models.py
- `BankingService` --uses--> `LogAuditoria`  [INFERRED]
  backend/app/services/banking_service.py → database/models.py
- `BankingService` --uses--> `RegistroEliminado`  [INFERRED]
  backend/app/services/banking_service.py → database/models.py

## Import Cycles
- None detected.

## Communities (85 total, 22 thin omitted)

### Community 0 - "BankingService"
Cohesion: 0.09
Nodes (47): add_cash_vault(), adjust_limit(), AdjustLimitRequest, get_all_deleted_records(), get_metrics(), initialize_vault(), BaseModel, get (+39 more)

### Community 1 - "backend/tests/test_hardening_and_agents.py"
Cohesion: 0.07
Nodes (32): EventBus, Any, Bus de eventos asincrono y mediador desacoplado para el enjambre multiagente de…, Valida la operatividad del enjambre multiagente Graphify a través de…, Valida el algoritmo DP/Backtracking para calcular desgloses exactos en…, Valida el endpoint /api/user/calculate-breakdown., Valida el algoritmo XOR Checksum para mitigar inyecciones seriales y Hardware…, Valida que entradas maliciosas con '|' o saltos de línea se escapen previniendo… (+24 more)

### Community 2 - "swarm_manager.py"
Cohesion: 0.07
Nodes (21): AgentContext, Any, Inspecciona el grafo generado por Graphify y verifica metricas de modularidad., Agent-Context (Sincronizacion Graphify AST): - Utiliza graphify-out/graph.json…, AgentDiagnostics, Any, Evalua la respuesta de hardware. Si hay atasco, gestiona el rollback contable y…, Agent-Diagnostics (Telemetria y Estado de Boveda): - Procesa la senal en tiempo… (+13 more)

### Community 3 - "backend/main.py"
Cohesion: 0.06
Nodes (30): ConnectionManager, websocket_endpoint(), BaseSettings, model_validator, Settings, favicon(), health_check(), lifespan() (+22 more)

### Community 4 - "ArduinoSerialController"
Cohesion: 0.09
Nodes (16): DispenseTestRequest, get_hardware_status(), JamSimulationRequest, BaseModel, get, post, test_dispense(), toggle_jam() (+8 more)

### Community 5 - "TxtStorageManager"
Cohesion: 0.12
Nodes (14): Any, datetime, Session, Registra la baja lógica en auditoria_eliminaciones.txt con formato:…, Extrae directamente de transacciones_historico.txt las últimas transacciones…, Gestor del patrón Dual-Write Concurrente para archivos de texto plano…, Sanitiza y escapa caracteres delimitadores (|) y saltos de línea (\r, \n) para…, sanitize_flat_field() (+6 more)

### Community 6 - "BankingService"
Cohesion: 0.14
Nodes (16): Algoritmo de Programación Dinámica y Backtracking con Branch-and-Bound: Calcula…, Ejecuta baja lógica estricta sin destrucción de registros (Soft Delete). Marca…, Bitácora estricta e inmutable de eliminaciones lógicas (Soft Delete). Almacena…, BankingService, Any, Session, ArqueoCajero, DenominacionCajero (+8 more)

### Community 7 - "frontend/src/App.tsx"
Cohesion: 0.08
Nodes (25): App(), HardwareBadges(), HardwareBadgesProps, BILL_CONFIGS, BillConfig, QuetzalBillCard(), QuetzalBillCardProps, VirtualKeypad() (+17 more)

### Community 8 - "modules/frontend/src/App.tsx"
Cohesion: 0.08
Nodes (25): App(), HardwareBadges(), HardwareBadgesProps, BILL_CONFIGS, BillConfig, QuetzalBillCard(), QuetzalBillCardProps, VirtualKeypad() (+17 more)

### Community 9 - "backend/app/core/security.py"
Cohesion: 0.13
Nodes (23): logout(), LogoutRequest, Cierre de sesión seguro con invalidación inmediata del token TOTP y del JWT.…, get_current_user(), Session, create_access_token(), decode_access_token(), invalidate_jwt_token() (+15 more)

### Community 10 - "generate_totp_token"
Cohesion: 0.12
Nodes (30): generate_totp_token(), fixture, Verifies that consuming the same TOTP token twice triggers an anti-replay…, Verifies that invoking logout immediately purges and blacklists the TOTP token…, Verifies non-destructive soft deletion, immutable archiving, and user-facing…, setup_vault_stock(), test_admin_vault_rules(), test_custom_withdrawal_inconsistent_bills() (+22 more)

### Community 11 - "Usuario"
Cohesion: 0.23
Nodes (17): get_db(), get_pin_hash(), init_db(), Módulo de Base de Datos y Persistencia Dual (MySQL InnoDB / SQLite + Archivos…, ArqueoCajero, DenominacionCajero, LogAuditoria, Base (+9 more)

### Community 12 - "modules/backend/app/core/security.py"
Cohesion: 0.10
Nodes (21): is_totp_token_blacklisted(), Checks if a TOTP token has been explicitly purged/blacklisted., Blacklists a JWT token on logout to prevent any subsequent usage., Generates deterministic salted SHA-256 hash for 4-digit PIN., Secure PIN comparison using constant-time comparison against salted hash.…, Creates signed JWT token with timezone-aware expiration timestamp., Decodes and validates JWT token signature, expiration, and blacklist status., Generates an active 6-digit TOTP token. Automatically advances the rotation… (+13 more)

### Community 13 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 14 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 15 - "modules/backend/app/api/user.py"
Cohesion: 0.22
Nodes (17): get_transactions(), Obtiene directamente de transacciones_historico.txt las últimas 5 transacciones…, calculate_breakdown(), CalculateBreakdownRequest, change_pin(), ChangePinRequest, deposit_money(), DepositRequest (+9 more)

### Community 16 - "backend/app/api/user.py"
Cohesion: 0.24
Nodes (15): calculate_breakdown(), CalculateBreakdownRequest, change_pin(), ChangePinRequest, deposit_money(), DepositRequest, get_my_deleted_records(), get_summary() (+7 more)

### Community 17 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 18 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 19 - "frontend/package.json"
Cohesion: 0.12
Nodes (15): axios, electron-builder, oxlint, postcss, react, tailwindcss, @types/react, typescript (+7 more)

### Community 20 - "modules/frontend/package.json"
Cohesion: 0.12
Nodes (15): autoprefixer, electron, lucide-react, react-dom, @types/node, @types/react-dom, axios, postcss (+7 more)

### Community 21 - "backend/tests/test_dual_write.py"
Cohesion: 0.13
Nodes (3): Valida el formato estricto del log forense de Soft Delete:…, test_auditoria_eliminaciones_txt_format(), test_auditoria_eliminaciones_txt_format()

### Community 22 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer, axios, electron, electron-builder, lucide-react, oxlint, postcss (+7 more)

### Community 23 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer, axios, electron, electron-builder, lucide-react, oxlint, postcss (+7 more)

### Community 24 - "get_token_preview"
Cohesion: 0.18
Nodes (12): get_atm_status(), get_token_preview(), login(), LoginRequest, BaseModel, get, post, Session (+4 more)

### Community 25 - "build"
Cohesion: 0.18
Nodes (11): build, appId, directories, files, linux, productName, win, output (+3 more)

### Community 26 - "build"
Cohesion: 0.18
Nodes (11): build, appId, directories, files, linux, productName, win, output (+3 more)

### Community 27 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, electron, electron:dev, lint, pack:linux, pack:win (+2 more)

### Community 28 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, electron, electron:dev, lint, pack:linux, pack:win (+2 more)

### Community 29 - "frontend/.oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 30 - "modules/frontend/.oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 31 - "frontend/electron/main.cjs"
Cohesion: 0.40
Nodes (3): { app, BrowserWindow, ipcMain }, fs, path

### Community 32 - "Settings"
Cohesion: 0.40
Nodes (3): BaseSettings, model_validator, Settings

### Community 33 - "modules/frontend/electron/main.cjs"
Cohesion: 0.40
Nodes (3): { app, BrowserWindow, ipcMain }, fs, path

### Community 34 - "dependencies"
Cohesion: 0.67
Nodes (3): dependencies, react, react-dom

### Community 39 - "dependencies"
Cohesion: 0.67
Nodes (3): dependencies, react, react-dom

## Knowledge Gaps
- **205 isolated node(s):** `HardwareBadgesProps`, `VirtualKeypadProps`, `BillConfig`, `QuetzalBillCardProps`, `Window` (+200 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 320 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `BankingService` connect `BankingService` to `backend/tests/test_hardening_and_agents.py`, `BankingService`, `backend/app/core/security.py`, `Usuario`, `modules/backend/app/api/user.py`, `backend/app/api/user.py`, `get_token_preview`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `generate_totp_token()` connect `generate_totp_token` to `get_token_preview`, `backend/app/core/security.py`, `modules/backend/app/core/security.py`, `backend/tests/test_hardening_and_agents.py`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `Usuario` connect `Usuario` to `BankingService`, `TxtStorageManager`, `BankingService`, `backend/app/core/security.py`, `modules/backend/app/api/user.py`, `backend/app/api/user.py`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 41 inferred relationships involving `BankingService` (e.g. with `add_cash_vault()` and `adjust_limit()`) actually correct?**
  _`BankingService` has 41 INFERRED edges - model-reasoned connections that need verification._
- **Are the 36 inferred relationships involving `Usuario` (e.g. with `add_cash_vault()` and `adjust_limit()`) actually correct?**
  _`Usuario` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `BankingService` (e.g. with `ArqueoCajero` and `DenominacionCajero`) actually correct?**
  _`BankingService` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `DenominacionCajero` (e.g. with `AgentLedger` and `get_atm_status()`) actually correct?**
  _`DenominacionCajero` has 9 INFERRED edges - model-reasoned connections that need verification._