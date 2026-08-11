# Phase 13B — Procurement Canonicalization

**Decision: `CompraOrden` (`purchase_orders`) is the CANONICAL procurement aggregate.**
Evidence-driven; confirmed by tracing the operational UI, writers and readers.

---

## 1. Implementations discovered & classification

| Implementation | Table / surface | Role | Classification |
|---|---|---|---|
| **`CompraOrden`** (+ `CompraOrdenItem`, `CompraOrdenDocumento`, `CompraOrdenHistorial`, `CompraOrdenTemplate`, `CompraOrdenSequence`) | `purchase_orders`, API `/api/compras/ordenes/**`, hooks `useCompraOrden`, pages `/compras/nueva`, `/compras/solicitudes`, `/compras/ordenes/[id]`, `/compras/bandeja`, `/compras/aprobaciones` | Active operational purchase order: draft → generate → issue → PDF → cancel/close, tax/discount, template snapshot, tenant-scoped, atomic `DocumentSequence` numbering | **CANONICAL** |
| **`CompraSolicitud`** (+ `CompraSolicitudItem`, `CompraAdjunto`, `CompraDocumento`, `CompraSequence`) | `compras_solicitudes`, API `/api/compras/solicitudes/**`, `src/lib/compras/service.ts`, `workflow-route.ts` | Earlier purchase-request model. **No frontend `fetch` consumer** for its API; until Phase 13 it was still read by the dashboard KPI and reports (the C-1 defect) | **DEPRECATED** (retain read-only for history until §5 confirms) |
| **`CompraOrden*Legacy`** (`CompraOrdenLegacy`, `…ItemLegacy`, `…DocumentoLegacy`, `…HistorialLegacy`, `…SequenceLegacy`) | schema only | **Zero code references** anywhere in `src/` | **DEAD** |
| `/api/purchases`, `/app/purchases` | deprecated handler + redirect | Superseded | **DEAD/COMPATIBILITY shim** (already returns a deprecation message / redirect) |

### Sequences
`DocumentSequence` (canonical, atomic allocator `allocateDocumentSequence`) supersedes `CompraSequence`, `CompraOrdenSequence`, and `CompraOrdenSequenceLegacy`. Canonical numbering = `DocumentSequence`.

---

## 2. Writers / Readers / Consumers (as-found)

**Canonical `CompraOrden`**
- Writers: `src/lib/compras/orden/service.ts` (create/update/generate/issue/cancel/close), disposal replacement projection (FK only).
- Readers (operational): `useCompraOrden` hook → `/api/compras/ordenes/**`; pages listed above.
- **After 13B/13C:** dashboard purchasing KPI and `/api/compras/reportes` (now canonical — see C-1 fix).

**Legacy `CompraSolicitud`**
- Writers: `src/lib/compras/service.ts` (+ `/api/compras/solicitudes/**`) — **no active UI writer path** (no frontend fetch to these endpoints).
- Readers (pre-13): `dashboard/page.tsx`, `/api/compras/reportes` → **migrated to canonical in Phase 13C.**
- Remaining readers: legacy service/workflow-route only (internally consistent, self-contained).

---

## 3. Canonical decision & rationale

`CompraOrden` is canonical because it is the aggregate the **active purchasing UI writes** and the one that drives **institutional order-document (PDF) generation**, tenant scoping, tax/discount math (Decimal), template snapshots and atomic numbering. `CompraSolicitud` has no active write path from the UI.

---

## 4. Read-path migration (Phase 13C — DONE)

| Consumer | Before | After |
|---|---|---|
| Dashboard `pendingPurchases` KPI | `compraSolicitud` estado ∈ {BORRADOR,GENERADA} | `compraOrden` status ∈ {DRAFT,GENERATED}, `deletedAt` null |
| `/api/compras/reportes` porEstado/sum/monthly/counts | `compras_solicitudes` by `fechaSolicitud` | `purchase_orders` by `requestDate`, **tenant-scoped** by `organizationId` |

Status vocabulary mapping used (canonical → legacy label code, UI-compat only):
`DRAFT→BORRADOR · GENERATED→GENERADA · ISSUED→EMITIDA · CANCELLED→ANULADA · CLOSED→CERRADA`.

Report contract preserved (`porEstado[].estado/_count/_sum`, `montoPorMes`, `ordenesEmitidas`, `enProceso`, `cerradas`, `anuladas`) so `src/app/compras/reportes/page.tsx` is unchanged. Regression test: `tests/contracts/c1-procurement-report-source.test.ts`.

---

## 5. Historical `CompraSolicitud` data strategy

**Selected: Strategy A — read legacy history separately, do NOT blindly copy rows.**

- Current operations and all operational reporting → `CompraOrden` (done).
- If check #16 of the integrity sweep shows `compras_solicitudes` holds legitimate historical institutional orders, expose them **only** through an explicitly-labelled "Histórico (legado)" read view sourced from `compras_solicitudes`, never merged silently into canonical figures.
- Strategy B (reviewed migration/import into `CompraOrden` preserving original number/dates/supplier/items/totals/status/source-reference) is deferred until the sweep quantifies legacy volume and a product owner confirms the records are institutionally relevant.

**Do not delete `CompraSolicitud` yet** — deferred to §6 gating.

---

## 6. Deprecation gating

Legacy procurement paths may be removed only when ALL hold:
1. No active frontend consumer — ✅ (no UI fetch to `/api/compras/solicitudes`).
2. No active API consumer — ✅ (verify once more before deletion).
3. No report/dashboard dependency — ✅ after Phase 13C.
4. No migration dependency — depends on §5 (Strategy A keeps a read dependency ⇒ retain until history is otherwise preserved).

Interim: mark legacy `/api/compras/solicitudes/**` and `src/lib/compras/service.ts` as `@deprecated` (JSDoc) and group under a documented "legacy" section. `CompraOrden*Legacy` models are DEAD and may be dropped in a dedicated, reviewed migration.

---

## 7. Financial verification (§17)

Canonical `CompraOrden` uses `Decimal(14,2)` for subtotal/discount/tax/total; the generation service computes and persists these, and the PDF renders the persisted snapshot. Independent recomputation (`total = subtotal − discount + tax`) is asserted by integrity check #7 (pending live run) and should be added as a unit test over the canonical calculation module. UI detail, PDF and (now-canonical) reports read the same `purchase_orders` rows, so the three surfaces are consistent by construction after C-1.
