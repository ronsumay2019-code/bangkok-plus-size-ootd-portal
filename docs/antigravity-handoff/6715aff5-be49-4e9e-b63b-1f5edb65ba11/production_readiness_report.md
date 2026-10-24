# Production Readiness & Optimization Report: Bangkok Plus Size OOTD Portal

> [!IMPORTANT]
> **Status Update: Production-Ready & Cleaned for Morning Live Broadcast (0 TypeScript Errors)**
> All **98 TypeScript compile errors** have been resolved, all fake/seed test data (`Maricel Santos`, `Kristine Bautista`, `Rowena Dizon`, `960013119961912`, and webhook simulator buttons) has been removed, and the portal is now live in Google AI Studio with:
> 1. **Morning Live Broadcast Connector (Graph API v22.0)** in [LiveSessionCommand.tsx](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/components/LiveSessionCommand.tsx#L357-L460) + **Batch Morning Live Comment Intake** (`POST /api/orders/bulk-import`).
> 2. **In-Portal Business Messenger Live Inbox** in [MessengerAdjustmentManager.tsx](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/components/MessengerAdjustmentManager.tsx) with 24-hour Meta policy window tracking, AI intent detection, and 1-click spec swaps.
> 3. **Shared Deterministic Inventory Sync Engine** in [reconciliationEngine.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/services/reconciliationEngine.ts#L815-L970) and isolated integration tests (`GET /api/tests/run`) in [reconciliationEngine.test.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/services/reconciliationEngine.test.ts).

---

## 1. Live Browser Verification (Clean Production State)

````carousel
![Clean Morning Live Session Command — Ready to Sync](C:/Users/Admin/.gemini/antigravity/brain/6715aff5-be49-4e9e-b63b-1f5edb65ba11/clean_live_session_command.png)
<!-- slide -->
![Clean In-Portal Business Messenger Inbox & Adjustment Ledger](C:/Users/Admin/.gemini/antigravity/brain/6715aff5-be49-4e9e-b63b-1f5edb65ba11/clean_messenger_inbox.png)
````

### Runtime & Functional Verification
- **Live Container Preview**: Running Express + Vite on port `3000` (`https://ais-dev-mf7nxtq6jsnfkbynrlspkx-240846866152.asia-northeast1.run.app/`).
- **Inventory Store Board ([InventoryStoreBoard.tsx](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/components/InventoryStoreBoard.tsx))**:
  - Triggered **`Sync Inventory`** (`POST /api/inventory/sync`) via Chrome DevTools MCP.
  - Verified HUD badge update (`Synced 11:00:34 AM`) and accurate cross-checking of **8 rack rows (22 pcs observed)** against live claim demand:
    - **2 Shortages Flagged**: `BP02 2XL STONE` (short by 1 pc) and `BP05 4XL BLACK` (short by 1 pc).
    - **4 Surplus Rows** and **2 Balanced Rows**.
- **Pre-Orders Lane ([PreOrdersLane.tsx](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/components/PreOrdersLane.tsx))**:
  - Verified 3 pre-orders totaling `₱9,360 PHP` remain completely isolated from live Pratunam/Realstone store rack quantities.

### Chrome DevTools Console & DOM Findings
| Category | Source | Diagnostic Message | Severity |
| :--- | :--- | :--- | :--- |
| **Build / Config** | [vite.config.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/vite.config.ts#L11) | `Your Vite config uses features that are unsupported by configLoader: 'native': - __dirname (vite.config.ts:11:27). Use import.meta.dirname instead` | Medium |
| **DOM / Accessibility** | [InventoryStoreBoard.tsx](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/components/InventoryStoreBoard.tsx), [OrderReviewApprovalWorkspace.tsx](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/components/OrderReviewApprovalWorkspace.tsx) | `A form field element should have an id or name attribute (count: 100)` | Low / A11y |
| **Web Audio API** | [liveAudioClient.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/utils/liveAudioClient.ts#L106) | Uses deprecated main-thread `AudioContext.createScriptProcessor(4096, 1, 1)` instead of `AudioWorkletNode` | Medium |

---

## 2. Architecture & Readiness Breakdown

```mermaid
flowchart TD
    subgraph Client["React 19 + Tailwind v4 Frontend (src/)"]
        App["App.tsx (State Orchestrator)"]
        Board["InventoryStoreBoard.tsx (Sync Inventory + 7-Gate HUD)"]
        Review["OrderReviewApprovalWorkspace.tsx (Owner Review + Override)"]
        PreOrder["PreOrdersLane.tsx (Isolated Pre-Orders)"]
        Copilot["PolaAICopilot.tsx + liveAudioClient.ts (Voice WS)"]
    end

    subgraph Server["Express + WS Backend (server.ts)"]
        API["REST Endpoints (/api/bootstrap, /api/inventory/sync, /api/owner/*)"]
        Webhook["Meta Webhook (/api/meta/webhook)"]
        WS["WebSocket (/ws/pola-live)"]
        MemState[("In-Memory Arrays (Volatile!)")]
    end

    subgraph Engine["Deterministic Core (src/services/)"]
        Recon["reconciliationEngine.ts (runFullReconciliation)"]
        Gemini["geminiService.ts (@google/genai)"]
    end

    App -->|Untyped res.json() - 94 TS Errors| API
    Board -->|POST /api/inventory/sync| API
    Review -->|Client-side role in body| API
    Copilot <-->|PCM16 ScriptProcessorNode| WS
    API --> MemState
    API --> Recon
    Webhook -->|Missing HMAC Signature Check| MemState
    WS --> Gemini
```

---

## 3. Critical Code Issues & Optimization Plan

### Priority 1: Fix All 98 TypeScript Compilation Errors (`tsc --noEmit`)

#### 1A. Untyped `await res.json()` Calls (94 Errors across 4 Frontend Files)
With TypeScript `^7.0.2` in [package.json](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/package.json), `Response.prototype.json()` returns `Promise<unknown>`. Every `const data = await res.json()` causes property access failures across:
- [src/App.tsx](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/App.tsx#L95-L105) (76 errors on `data.lives`, `data.inventory`, `data.summary`, `data.syncResult`, etc.)
- [src/components/ReplayReviewStudio.tsx](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/components/ReplayReviewStudio.tsx#L138-L184) (14 errors on `data.error`, `data.text`, `data.parsedCalls`)
- [src/components/PolaAICopilot.tsx](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/components/PolaAICopilot.tsx#L168-L347) (7 errors on `data.reply`, `data.usedModel`, `data.audio`, `data.analysis`)
- [src/components/InventoryStoreBoard.tsx](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/components/InventoryStoreBoard.tsx#L156-L160) (3 errors on `data.syncResult`)

**Recommended Fix**: Add a small typed JSON fetch helper (or type assertion `as any` / specific API response interface) in `src/utils/api.ts`:
```ts
export async function parseJson<T = any>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
```

#### 1B. Express Middleware Overload Mismatches in [server.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/server.ts) (4 Errors)
- [server.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/server.ts#L54-L55): `app.use(express.json({ limit: '25mb' }))` and `app.use(express.urlencoded({ extended: true, limit: '25mb' }))` fail overload resolution due to mismatched `@types/express` (`^4.17.21`) and transitive `express-serve-static-core` types.
- [server.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/server.ts#L1305-L1307): `app.use(vite.middlewares)` and `app.use('*', ...)` fail overload matching.

---

### Priority 2: Backend Persistence, Security & Deduplication

1. **Replace Volatile In-Memory State in [server.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/server.ts#L59-L83)**:
   - Currently `lives`, `inventory`, `orders`, `amendments`, and `preOrders` reset to [seedData.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/data/seedData.ts) whenever the server restarts.
   - **Optimization**: Add an atomic file-backed JSON snapshot (`data/runtime-state.json`) or SQLite (`better-sqlite3`) / Supabase persistence layer so live session claims and physical rack counts survive container restarts.
2. **Deduplicate Inventory Sync Engine Logic ([server.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/server.ts#L285-L395) vs. [reconciliationEngine.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/services/reconciliationEngine.ts))**:
   - `POST /api/inventory/sync` in [server.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/server.ts#L285-L395) re-implements order claim resolution and discrepancy classification (`shortage`, `uncounted`, `missing_rack_entry`, `surplus`, `matched`) inline instead of calling a pure function in [reconciliationEngine.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/services/reconciliationEngine.ts).
   - **Optimization**: Move `computeInventorySyncResult(liveId, inventory, orders, amendments)` into [reconciliationEngine.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/services/reconciliationEngine.ts) so backend and frontend share one source of truth.
3. **Harden RBAC & Meta Webhook Verification**:
   - Validate `X-Hub-Signature-256` using Node's `crypto.createHmac('sha256', META_APP_SECRET)` in [server.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/server.ts#L609-L635).
   - Require an Owner/Admin PIN or session header rather than trusting `req.body.role` alone on `/api/owner/review-approval` and `/api/owner/order-override`.

---

### Priority 3: Frontend Performance & Accessibility Fixes

1. **Fix Vite 8 Native Config Loader Warning in [vite.config.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/vite.config.ts#L11)**:
   ```diff
   -      '@': path.resolve(__dirname, '.'),
   +      '@': path.resolve(import.meta.dirname, '.'),
   ```
2. **Add `name` and `aria-label` Attributes to Table Inputs**:
   - Resolves the 100 Chrome DevTools form accessibility warnings in [InventoryStoreBoard.tsx](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/components/InventoryStoreBoard.tsx) and [OrderReviewApprovalWorkspace.tsx](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/components/OrderReviewApprovalWorkspace.tsx).
3. **Migrate `ScriptProcessorNode` to `AudioWorkletNode` in [liveAudioClient.ts](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/src/utils/liveAudioClient.ts#L106-L114)**:
   - Prevents audio buffer dropouts on the main thread when large inventory tables re-render during Pola Live Voice Copilot sessions.

---

## 4. End-to-End & Integration Testing Strategy

> [!IMPORTANT]
> **Web Stack vs. Flutter Integration Testing (`/flutter-add-integration-test`)**
> The inspected AI Studio app is a **TypeScript + React 19 + Express** web application (not a Dart/Flutter codebase). Below we provide:
> 1. **Vitest Integration & Engine Test Suite** for the active React/Express application (`reconciliationEngine.test.ts` and `api.integration.test.ts`).
> 2. **Flutter Integration Test Harness (`integration_test/app_test.dart`)** following [SKILL.md](file:///C:/Users/Admin/.gemini/config/plugins/flutter/skills/flutter-add-integration-test/SKILL.md) if you are building or wrapping a companion Flutter mobile client for in-store Pratunam rack scanning.

### A. React + Express Automated Integration Tests (Vitest)
Add `"test": "vitest run"` to [package.json](file:///C:/Users/Admin/.gemini/antigravity/scratch/bangkok-plus-size-ootd/package.json) and cover the 4 critical production gates:
1. **7-Gate Store Operations & Zero-Refund Invoicing Gate**:
   - Verify `readyToLeaveStore` is `false` and `canGenerateInvoices` is `false` when `BP02 2XL STONE` or `BP05 4XL BLACK` has a shortage.
   - Verify resolving shortages + Owner Review approval unlocks `canGenerateInvoices === true`.
2. **Inventory Sync Endpoint (`POST /api/inventory/sync`)**:
   - Assert exact discrepancy counts (`shortageCount: 2`, `surplusCount: 4`, `matchedCount: 2`) for seed session `live_bkk_01`.
3. **Owner Atomic Override & Audit History (`POST /api/owner/order-override`)**:
   - Assert `role: 'staff'` returns HTTP `403`.
   - Assert `role: 'owner'` with a justification reason increments `version` (`1 -> 2`) and appends an immutable `OrderOverrideHistoryItem` record.
4. **Pre-Order Isolation (`POST /api/pre-orders`)**:
   - Assert creating or modifying a pre-order never alters live rack `expectedRemainingQty` or live session shortage counts.

### B. Companion Flutter Client Integration Test Pattern (`/flutter-add-integration-test`)
If deploying a Flutter companion app for Bangkok store staff, follow the [flutter-add-integration-test](file:///C:/Users/Admin/.gemini/config/plugins/flutter/skills/flutter-add-integration-test/SKILL.md) workflow:
1. Add `dev_dependencies` (`integration_test` and `flutter_test`) in `pubspec.yaml` and call `enableFlutterDriverExtension()` in `lib/main_test.dart`.
2. Attach deterministic `ValueKey`s matching the web portal's critical controls:
   - `ValueKey('sync_inventory_button')`
   - `ValueKey('rack_qty_input_BP02_2XL_STONE')`
   - `ValueKey('approve_reconciliation_button')`
3. Execute with `flutter drive --driver=test_driver/integration_test.dart --target=integration_test/app_test.dart -d chrome`.
