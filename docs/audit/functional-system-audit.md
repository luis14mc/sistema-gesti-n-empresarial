# SGE — Functional Information Systems Audit (Phase 12)

**Audit type:** Independent external functional / information-systems audit
**Target:** Sistema de Gestión Empresarial (SGE) — internal institutional application
**Repository state:** branch `main`, commit `8d3c867` (working tree with staged SaaS-foundation changes)
**Audit date:** 2026-08-03
**Auditors (roles):** IS Auditor · IT Auditor · Software Architect · Business Analyst · Functional Analyst · QA Auditor · Internal-Controls Specialist · Process Analyst · Security Auditor · Database Auditor · IT-Governance Analyst · Risk Analyst · Product-Quality Analyst

> **Scope note.** This is a functional-completeness audit, not a SaaS feature request. A capability is scored *complete* only when its full business workflow operates from input to final result. Presence of a route, page, model, endpoint, test or button is **not** accepted as evidence of completeness. No production behaviour, schema, permission or workflow was modified during this audit; only read-only inspection and the standard verification commands were executed.

---

## 1. Executive summary

The SGE is a **Next.js 16 / React 19 / Prisma 7 / PostgreSQL** institutional application organised around correspondence (*oficios*), IT assets (*equipos*), procurement (*compras*), people (*empleados/usuarios*) and auditing. Engineering quality of the **core operational modules is genuinely high**: the equipment-disposal, oficio and equipment-assignment workflows use transactional integrity, optimistic concurrency, atomic sequence allocation, tenant scoping and rich audit-event recording. The full verification battery is green (prisma validate ✓, typecheck ✓, lint ✓, **728/728 tests pass**).

However, the system is **not uniformly complete**. A large "SaaS foundation" layer (multi-organization lifecycle, integrations, notifications, background jobs, outbox, reporting engine) was **scaffolded at the API/schema level but never connected to the UI or a runtime processor**. Several subsystems are *technically present but functionally unusable*:

- The **background worker is a stub** that throws `BACKGROUND_JOB_PROCESSOR_NOT_IMPLEMENTED`; the **domain-event outbox is never written to and has no consumer**; **notifications have no UI surface, no email backend, and are only dispatched from one non-core path (org lifecycle)**.
- The **procurement domain contains three parallel data models** (`CompraOrden` = canonical, `CompraSolicitud` = parallel, `CompraOrden*Legacy` = dead), and — most seriously — the **dashboard KPI and the purchase reports read `CompraSolicitud`, while the operational UI writes `CompraOrden`.** Institutional purchase figures shown to users therefore do not reflect the orders actually created.
- The **institutional Audits module** (planning → findings → checklist → corrective actions) is fully built with pages and APIs but is **absent from navigation** (disconnected). The "Auditoría" menu entry points to the *system* audit log instead.
- **Organization/Platform administration and Integrations** have a rich API surface but **zero UI pages** (foundation-only).

**Overall functional completeness: ≈ 63%** → **"Functional but incomplete" / lower Operational Beta.**
**Production recommendation: GO WITH CONDITIONS** — the correspondence, equipment, assignment and disposal scope is deployable; procurement reporting and the notification/eventing layer must be corrected first (see §21, P0).

---

## 2. Scope

Audited: Dashboard · Oficios (Correspondencia) · Activos (Equipos, Asignaciones, Mantenimiento, Baja) · Compras · Personas (Empleados, Usuarios) · Auditoría (institucional + sistema) · Notificaciones · Reportes · Configuración · Organización/Plataforma · Integraciones · Background jobs / Outbox · Documents/PDF · Storage · Permissions · Data integrity.

Method: source inspection of routes, pages, application/domain services, Prisma schema + migrations, permission matrix, PDF/storage layer, worker/jobs/outbox, tests, and execution of the mandated verification commands. Behaviour was inferred from code paths, not filenames.

---

## 3. Audit methodology

Evidence classes used per finding: `IMPLEMENTED`, `PARTIALLY_IMPLEMENTED`, `PLACEHOLDER`, `DEPRECATED`, `DISCONNECTED`, `NOT_IMPLEMENTED`, `BROKEN`, `FOUNDATION_ONLY`, `NOT_APPLICABLE`. Functional score 0–5 per capability. Severity: CRITICAL / HIGH / MEDIUM / LOW / OBSERVATION. Weighted overall per the internal-system weighting in §19.

---

## 4. System architecture observed

- **Web:** Next.js 16 App Router. Server pages + client components; React Query for data; Radix UI + Tailwind v4; SweetAlert2/Sileo for dialogs.
- **API:** App-Router route handlers under `src/app/api/**` wrapped by `withAuth` middleware; standardised `apiSuccess`/`apiFailure` envelopes with `requestId`.
- **Domain layering:** `src/modules/**` (oficios, equipment, equipment-disposal, audits, notifications, organizations, reporting) follow presentation/application/domain/infrastructure separation. `src/platform/**` provides cross-cutting services (sequences, audit, pdf, storage, events, jobs, security, config, health).
- **Data:** PostgreSQL via `@prisma/adapter-pg`, 96 models/enums, 16 migrations. Tenant column `organizationId` on operational tables.
- **Worker:** `src/worker/index.ts` — **stub processor, not implemented** (evidence §16).
- **PDF:** Puppeteer via `src/platform/pdf/browser.ts` + `src/lib/compras/pdf-renderer.ts`, generated **synchronously in-request**.
- **Auth:** JWT (`jsonwebtoken`) + bcrypt; HttpOnly cookie; `/api/auth/me`.

---

## 5. Modules discovered (incl. those absent from navigation)

| Exposed in navigation | In code but NOT navigable | Deprecated / dead |
|---|---|---|
| Dashboard, Oficios, Equipos (Inventario + Dictámenes de baja), Empleados, Asignaciones, Compras (Órdenes→solicitudes, Nueva, Formato CNI, Reportes), Auditoría (→ system logs), Usuarios, Ajustes | **Institutional Audits** (`/audits`, findings/checklist/corrective-actions), **Proveedores** (`/compras/proveedores`), **Aprobaciones/Bandeja** (`/compras/aprobaciones`, `/compras/bandeja`), **Audit-records / admin audit logs** (`/audit-records`, `/admin/audit-logs`), **Notifications** (API only, no page), **Organization admin** (`/api/organizations/current/*`), **Platform admin** (`/api/platform/organizations/*`), **Integrations** (`/api/organizations/current/integrations/*`), **Reports catalog** (`/api/reports/catalog`) | `/api/purchases` (deprecated handler), `/app/purchases` (redirect), **`CompraOrden*Legacy`** model family (no code references), `Ticket`/`TimeEntry`/`PromotionalItem`/`AttendancePolicy` models (API/components without navigation) |

---

## 6. Functional inventory (condensed)

- **Correspondence:** `Oficio`, `OficioDocument`, `OficioTracking`, `OficioImportBatch(+Item)`. Types `CNI/DESPACHO/INTERNO`, directions incoming/outgoing, status transitions, sequence numbering, historical import. — **IMPLEMENTED**
- **Equipment:** `Equipment` (8 lifecycle states), `EquipmentAssignment`, `EquipmentHistory`, `EquipmentMaintenance`, `EquipmentDisposal(+Document/History)`, `ReplacementProjection`. — mostly **IMPLEMENTED**; maintenance **PARTIALLY**.
- **Procurement:** `CompraOrden` (canonical) + `CompraOrdenItem/Documento/Historial/Sequence/Template`; `CompraSolicitud(+Item/Adjunto)` (parallel); `CompraOrden*Legacy` (dead); `Proveedor`, `CostCenter`, `DocumentSequence`. — **IMPLEMENTED w/ major duplication**.
- **People:** `Employee`, `User`, `Department`, `JobPosition`, `Organization(Membership)`. — **IMPLEMENTED**.
- **Auditing:** `Audit`, `AuditFinding`, `AuditChecklistItem`, `CorrectiveAction` (institutional, disconnected); `SystemAuditEvent` (system, IMPLEMENTED).
- **Cross-cutting:** `Notification(+Delivery)`, `DomainEventOutbox`, `ReportExecution`, `OrganizationIntegration(+Execution)`, `DisposalPolicy`. — **FOUNDATION_ONLY**.

---

## 7. Module scores

Score = functional maturity 0–5 (10-point subscale shown as /50 and %). Percentages reflect *operational completeness of the full workflow*, not test pass rate.

| Module | Expected fns | Impl | Partial | Missing/Broken | Score /5 | % | Critical findings |
|---|---|---|---|---|---|---|---|
| Dashboard | 8 | 6 | 1 | 1 | 3 | 60% | Purchases KPI reads wrong table (`CompraSolicitud`) |
| Oficios (Correspondencia) | 12 | 10 | 2 | 0 | 4 | 80% | Notifications not wired |
| Equipos — Inventario | 8 | 7 | 1 | 0 | 4 | 80% | — |
| Asignaciones | 8 | 6 | 1 | 1 | 3 | 65% | Single-active guard app-only (no DB constraint) |
| Mantenimiento | 8 | 3 | 3 | 2 | 2 | 45% | No nav entry; cost/history not in reports |
| Baja de equipos (Disposal) | 10 | 9 | 1 | 0 | 5 | 92% | Strongest workflow; PDF sync only |
| Compras (Órdenes) | 12 | 8 | 2 | 2 | 3 | 62% | Triple model duplication; reports/dashboard mismatch |
| Proveedores | 6 | 5 | 0 | 1 | 3 | 65% | Hidden from navigation |
| Empleados | 8 | 7 | 1 | 0 | 4 | 80% | — |
| Usuarios | 8 | 5 | 2 | 1 | 3 | 62% | Dual role systems; no session-revoke/reset UI |
| Auditoría — Sistema (logs) | 7 | 6 | 1 | 0 | 4 | 80% | — |
| Auditoría — Institucional | 8 | 6 | 1 | 1 | 2 | 45% | Fully built but DISCONNECTED from nav |
| Notificaciones | 10 | 2 | 2 | 6 | 1 | 20% | No UI, no email, only org-lifecycle trigger |
| Reportes | 8 | 2 | 2 | 4 | 2 | 35% | Foundation-only; no CSV/XLSX export; wrong source table |
| Configuración (Ajustes) | 8 | 3 | 1 | 4 | 2 | 40% | Only profile/password; org/policy settings no UI |
| Organización / Plataforma | 8 | 1 | 1 | 6 | 1 | 20% | Rich API, zero UI (FOUNDATION_ONLY) |
| Integraciones | 8 | 1 | 1 | 6 | 1 | 20% | Rich API, no adapters/consumers/UI |
| Background jobs / Outbox | 8 | 1 | 1 | 6 | 1 | 15% | Worker stub throws; outbox never used |

**System Functional Score (module-weighted): ≈ 58%.**

---

## 8. Workflow scores

| Workflow | Start | Intermediate | Completion | Docs | Audit | Notif | Reports | Score /5 | % |
|---|---|---|---|---|---|---|---|---|---|
| Correspondence (oficio) | create/receive ✓ | classify/attach/track ✓ | complete/archive ✓ | ✓ | ✓ | ✗ | partial | 4 | 80% |
| Equipment assignment | select emp+equip ✓ | assign (txn guard) ✓ | return ✓ | ✓ | ✗ | ✓(history) | ✗ | 3 | 70% |
| Maintenance | schedule ✓ | start/cost/evidence ~ | complete ~ | ~ | ✓ | ✗ | ✗ | 2 | 50% |
| Disposal (baja) | diagnosis ✓ | evaluation/evidence/submit ✓ | approve→DISPOSED (atomic, once) ✓ | PDF ✓ | ✓ | ✗ | projection ✓ | 5 | 92% |
| Procurement | draft ✓ | items/tax/discount ✓ | generate/emit/PDF ✓ | ✓ | ✓ | ✗ | **wrong table** | 3 | 65% |

**Critical Workflow Score: ≈ 71%.**

---

## 9. Critical findings (CRITICAL)

**C-1 — Dashboard KPI and Purchase Reports read a different table than the operational purchase UI writes.**
Evidence: `src/app/dashboard/page.tsx:24` → `prisma.compraSolicitud.count(...)`; `src/app/api/compras/reportes/route.ts:29-51` → `prisma.compraSolicitud.groupBy/count`; operational create flow `src/app/compras/nueva/page.tsx` + `useCompraOrdenes` writes **`CompraOrden`** (`purchase_orders`). The two tables are distinct. Institutional purchase totals, monthly charts and status counts shown to users **do not reflect the purchase orders actually created**.
Impact: incorrect official/management figures; invalid reporting. **Severity: CRITICAL** (data/reporting integrity).

**C-2 — Background worker is a non-functional stub.**
Evidence: `src/worker/index.ts` uses `unavailableProcessor` whose `start()` throws `BACKGROUND_JOB_PROCESSOR_NOT_IMPLEMENTED`. Any capability that assumes async processing (email delivery, outbox projection, deferred PDF) will never run. Mitigation observed: `SynchronousJobDispatcher` runs the few used jobs in-request, and PDFs are generated synchronously — so there is **no data loss today**, but the async/eventing/notification operational layer is inert.
Impact: operational-readiness gap; silent non-delivery of notifications/events. **Severity: CRITICAL** (operational), **downgraded to HIGH** in practice because no core workflow currently depends on it.

---

## 10. High findings (HIGH)

**H-1 — Domain-event outbox is write-never / consume-never.** `appendOutboxEvent` (`src/platform/events/outbox.ts`) is **not called anywhere**, and there is **no outbox processor**. `DomainEventOutbox` model + migration exist but carry no runtime behaviour. Classify **FOUNDATION_ONLY**.

**H-2 — Notifications are effectively disconnected.** The dispatcher (`src/modules/notifications/application/dispatcher.ts`) is invoked **only** from `src/modules/organizations/application/lifecycle.ts`. No core module (oficios, compras, equipment, disposal, assignments, maintenance) emits notifications. There is **no notification UI** (no bell/center in `MainLayout.tsx`, no notification components) and **no email backend** (`NotificationDelivery` is an enum only; no SMTP/nodemailer). Users cannot receive or read notifications.

**H-3 — Institutional Audits module is fully built but not navigable.** Pages `/audits`, `/audits/[id]` and APIs `/api/audits/**`, `/api/corrective-actions/**` exist with findings/checklist/corrective-actions, but `MainLayout.tsx` `NAV_ITEMS` contains no `/audits` entry; "Auditoría" points to `/audit/logs` (system audit). The entire institutional-audit workflow is **DISCONNECTED**.

**H-4 — Triple/parallel procurement implementation.** Canonical `CompraOrden` (+ full API `/api/compras/ordenes/**`); parallel `CompraSolicitud` (+ full API `/api/compras/solicitudes/**` with anular/cerrar/emitir/generar-orden/imprimir/regenerar-pdf) with **no frontend fetch consumer**; and dead `CompraOrden*Legacy` family (no code references). Even the deprecation message (`src/lib/deprecated-api.ts`) points `/api/purchases` to *solicitudes*, while the UI uses *ordenes* — the codebase itself disagrees on the canonical system.

**H-5 — Reporting engine is foundation-only.** `src/modules/reporting/**` provides catalog/metrics/filter-validation/execution repository and `ReportExecution` model, but **no CSV/XLSX/PDF export is generated** (no `text/csv`, `xlsx`, `exceljs` producers). The only working report page is `/compras/reportes` (which suffers C-1). "Reportes" as a general module is not operational.

**H-6 — Organization/Platform administration and Integrations have no UI.** Extensive APIs (`/api/organizations/current/**`, `/api/platform/organizations/**`, integrations enable/disable/test/rotate-credentials/executions) exist with **zero pages**. Multi-org lifecycle and integrations are **FOUNDATION_ONLY**; there are no real integration adapters/consumers.

---

## 11. Medium findings (MEDIUM)

**M-1 — Single active assignment guaranteed only at application level.** `src/app/api/equipment-assignments/route.ts:113-121` checks `assignments where status ACTIVE` inside a transaction, but there is **no DB partial-unique constraint** on `(equipmentId) WHERE status='ACTIVE'`. Under READ COMMITTED, two concurrent assignments could theoretically both pass the check. Add a DB-level guard.

**M-2 — Dual permission systems.** Enforced authorization uses the **global `Role` enum** (ADMIN/USER/RRHH/IT) via `src/lib/permissions.ts`. The schema's `OrganizationRole` / `OrganizationMembership` / `PlatformRole` (org-scoped RBAC) is **not consulted** by the operational permission checks — an unused parallel model.

**M-3 — Proveedores hidden from navigation.** `/compras/proveedores` exists and works but is absent from the Compras submenu; suppliers are only reachable indirectly.

**M-4 — Maintenance lacks a first-class surface.** `EquipmentMaintenance` + `/api/maintenance/**` exist and are embedded in the equipment page, but there is no navigation entry and maintenance cost/history is not exposed in any report.

**M-5 — Configuración is user-scoped only.** `/settings` covers profile + password (+ appearance). Institutional configuration (disposal policy, module entitlements, org identity beyond compras) has **no editing UI**; `DisposalPolicy`/`AttendancePolicy` are consumed but not configurable through the app.

---

## 12. Low findings (LOW)

- **L-1** Compras navigation label "Órdenes de compra" links to `/compras/solicitudes`, whose page actually renders `CompraOrden` data — terminology/route mismatch that confuses users.
- **L-2** Deprecated `/api/purchases` and `/app/purchases` redirect remain in the tree (harmless but dead surface).
- **L-3** `Ticket`, `TimeEntry`, `PromotionalItem`, `AttendancePolicy` models + components exist without navigation — likely FUTURE/ABANDONED; should be labelled.
- **L-4** "Auditoría" is an overloaded term (institutional vs system) with no in-UI disambiguation.

---

## 13. Dead / legacy functionality

| Item | Classification | Evidence |
|---|---|---|
| `CompraOrden*Legacy` (5 models) | ABANDONED (dead schema) | No code references (`grep` empty) |
| `/api/purchases`, `/app/purchases` | DEPRECATED | `deprecated-api.ts`, redirect page |
| `CompraSolicitud` API tree (anular/cerrar/emitir/generar-orden/imprimir…) | LEGACY/parallel | No frontend fetch; only reports/dashboard read the table |
| `DomainEventOutbox` + `appendOutboxEvent` | FUTURE / FOUNDATION_ONLY | No producers/consumers |
| `OrganizationIntegration` / `IntegrationExecution` | FUTURE / FOUNDATION_ONLY | No UI, no adapters |
| `Ticket`, `TimeEntry`, `PromotionalItem`, `AttendancePolicy` | FUTURE / STILL_REQUIRED? | API/components, no nav |

---

## 14. Duplicate functionality

- **Procurement:** `CompraOrden` (canonical) vs `CompraSolicitud` (parallel) vs `CompraOrden*Legacy` (dead) — three concepts for one business object. **Canonical = `CompraOrden`.**
- **Purchase sequences:** `CompraSequence`, `CompraOrdenSequence`, `CompraOrdenSequenceLegacy`, `DocumentSequence` — overlapping numbering strategies. Consolidate on `DocumentSequence` (used by the atomic allocator).
- **Permissions:** global `Role` matrix vs org-scoped `OrganizationRole` — pick one (§M-2).
- **Audit:** institutional `Audit*` vs `SystemAuditEvent` — legitimately distinct, but disambiguate in UI/labels.

---

## 15. Data-integrity findings

| Check | Result | Evidence |
|---|---|---|
| Sequence allocation atomic | PASS | `allocateDocumentSequence` upsert+increment in txn |
| Disposal approval updates equipment exactly once | PASS | `service.approve` version-guarded `updateMany`, single `equipment.update` → DISPOSED |
| Disposal reject/cancel restores prior status | PASS | `restoreAndClose` restores `previousEquipmentStatus` |
| Impossible equipment states blocked at creation of disposal | PASS | guards against `DISPOSAL_IN_PROGRESS/DISPOSED/RETIRED/LOST` |
| Single active assignment | PARTIAL | app-enforced only, no DB constraint (M-1) |
| Purchase figures reflect real orders | **FAIL** | dashboard/reports read `CompraSolicitud` (C-1) |
| Outbox eventually processed | **FAIL** | no consumer (H-1) |
| Notifications delivered | **FAIL** | no dispatch from core paths, no email (H-2) |
| Tenant scoping (`organizationId`) | PASS (spot) | present on operational tables and queries |

> A live read-only integrity SQL sweep (orphan records, duplicate active assignments, approved disposals without disposed equipment, purchase-total consistency) is **recommended as a follow-up** against a production snapshot; static analysis already surfaces the FAIL rows above.

---

## 16. Operational findings

- **Worker not implemented** (`src/worker/index.ts` → throws). No async job execution.
- **No operational visibility** for jobs/outbox/notifications (no admin screens).
- **PDF generation is synchronous** (Puppeteer in-request) — works but couples request latency to Chromium; no retry/queue.
- **Health endpoints present** (`/api/health`, `/live`, `/ready`) — good.
- **Verification battery green** (§20) — build integrity is solid.

---

## 17. UX findings

- Consistent Spanish UI, Radix components, empty/loading states present on primary lists; SweetAlert/Sileo feedback on mutations.
- **Hidden important features** (institutional Audits, Proveedores) hurt discoverability.
- **Procurement terminology mismatch** (solicitudes vs órdenes) is confusing (L-1).
- **No notification center** — users have no in-app inbox.
- Responsive/accessibility not exhaustively tested this pass (recommended: keyboard/dialog/table sweep at 360–1920px) — no blocking defect observed in layout code, but treat as **unverified**.

---

## 18. Security / control findings

- **AuthN:** JWT + bcrypt + HttpOnly cookie — sound.
- **AuthZ:** enforced server-side via `withAuth` + `requirePermission`/`hasModuleAccess`; disposal endpoints rate-limited. Good.
- **Tenant isolation:** `organizationId` pervasive; deletes use `onDelete: Restrict` on key relations (suppliers/creators) — referenced records protected.
- **Gaps:** dual RBAC (M-2); org-scoped role unused; no session-revoke/password-reset UI (users module); CSV formula-injection protection **N/A** (no CSV export exists yet — must be added *with* export).

---

## 19. Overall score (weighted)

| Dimension | Weight | Score | Contribution |
|---|---|---|---|
| Functional modules | 30% | 58% | 17.4 |
| Critical workflows | 25% | 71% | 17.8 |
| Data integrity | 15% | 62% | 9.3 |
| Security & controls | 10% | 72% | 7.2 |
| Operational readiness | 10% | 45% | 4.5 |
| UX & usability | 10% | 68% | 6.8 |
| **Weighted total** | 100% | — | **≈ 63.0%** |

**Classification: Functional but incomplete (50–64%) — lower Operational Beta.**

---

## 20. Verification (mandated commands)

| Command | Result |
|---|---|
| `pnpm prisma validate` | ✅ exit 0 |
| `pnpm prisma generate` | ✅ (covered by build/typecheck; schema valid) |
| `pnpm lint` | ✅ exit 0 |
| `pnpm typecheck` | ✅ exit 0 |
| `pnpm test` | ✅ **728 passed / 728**, 85 files |
| `pnpm build` | ✅ exit 0 (web `.next` + worker bundle `dist/worker/index.js` 540.9kb) |

> **Reminder for readers:** green compilation and passing tests validate *technical* integrity only. They do **not** demonstrate that the procurement figures are correct, that notifications reach recipients, or that the institutional-audit workflow is reachable — all of which fail functionally (§9–§11).

---

## 21. Prioritized remediation plan

### P0 — Required before institutional production
1. **Fix procurement reporting source (C-1).** Point `dashboard/page.tsx` and `compras/reportes/route.ts` at `CompraOrden` (or reconcile the two models). Verify totals against source rows.
2. **Decide canonical procurement model and quarantine the rest (H-4).** Keep `CompraOrden`; formally deprecate/remove `CompraSolicitud` API tree and dead `*Legacy` models; align `deprecated-api.ts` message.
3. **Either wire or explicitly disable the eventing/notification layer (C-2, H-1, H-2).** If retained: implement the worker processor + outbox consumer + notification UI + email delivery. If deferred: mark `Notification`, `DomainEventOutbox`, worker, integrations as FOUNDATION_ONLY in docs and hide any entry points, so nothing appears operational when it is not.

### P1 — Required shortly after production
4. **Reconnect institutional Audits to navigation (H-3)** (or explicitly retire it).
5. **Add DB partial-unique constraint for active assignments (M-1).**
6. **Implement real report exports (CSV/XLSX) with formula-injection protection (H-5).**
7. **Expose Proveedores and Maintenance in navigation (M-3, M-4).**
8. **Resolve dual RBAC (M-2)** — collapse to a single enforced model.

### P2 — Improvement
9. Build Organization/Platform + Integrations admin UI or defer explicitly (H-6).
10. Rename procurement routes/labels for consistency (L-1); prune deprecated `/purchases` surface (L-2); label FUTURE modules (L-3).
11. Institutional configuration UI (disposal/attendance policy, org identity) (M-5).
12. Full responsive + accessibility sweep; live read-only integrity SQL sweep.

---

## SYSTEM FUNCTIONAL AUDIT — FINAL VERDICT

```
Overall Functional Completeness: ≈ 63%

Classification: Functional but incomplete (lower Operational Beta)

Critical workflows passing (functionally end-to-end): 3 / 5
  ✓ Correspondence   ✓ Equipment assignment   ✓ Disposal
  ⚠ Procurement (works but reporting reads wrong table)
  ⚠ Maintenance (partial, no reporting)

Modules fully operational: 4 / 18
  Disposal, Oficios, Equipment-Inventory, System-Audit-Log
  (strong: Empleados, Proveedores just below the bar)

P0 findings: 3   (C-1, H-4 canonicalization, C-2/H-1/H-2 eventing)
P1 findings: 5   (H-3, H-5, M-1, M-3/M-4, M-2)
P2 findings: 4+  (H-6, L-1..L-4, M-5)

Production recommendation: GO WITH CONDITIONS
```

**Reasons for GO WITH CONDITIONS (not GO):**
- **C-1** shows users incorrect institutional purchase figures — must be fixed before procurement is trusted for official use.
- **H-2/H-1/C-2** leave notifications/eventing inert and unlabelled — either implement or explicitly mark FOUNDATION_ONLY so operators are not misled.
- **H-3** hides a complete institutional-audit capability.

**Reasons it is not NO-GO:** the core correspondence, equipment, assignment and **disposal** workflows are transactionally correct, tenant-scoped, audited and production-grade; verification is fully green; no data-loss defect was found. With the three P0 items addressed, the correspondence/equipment/disposal scope is deployable for institutional operation.

*Do not proceed to remediation until these findings are reviewed and approved. This document is evidence-based; every finding cites file/route/model.*
