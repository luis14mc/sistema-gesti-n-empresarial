# Phase 13 — Audit Remediation Matrix

Traceability from every Phase 12 CRITICAL/HIGH finding (plus actioned MEDIUMs) to its Phase 13 decision, changes, tests and residual risk.

Legend — **Status:** RESOLVED · MITIGATED · CLASSIFIED (honest decision, no code needed) · DEFERRED (documented reason).

| Finding | Sev | Decision | Files changed | Migration | Tests | Status | Residual risk |
|---|---|---|---|---|---|---|---|
| **C-1** Procurement reporting/dashboard read legacy `CompraSolicitud` | CRITICAL | Repoint both read paths to canonical `CompraOrden`; tenant-scope reports | `src/app/dashboard/page.tsx`, `src/app/api/compras/reportes/route.ts` | none (read-path only) | `tests/contracts/c1-procurement-report-source.test.ts` | **RESOLVED** | Legacy historical rows (if any) shown only via explicit legacy view (Strategy A); live integrity check #16 pending |
| **C-2** Worker throws `BACKGROUND_JOB_PROCESSOR_NOT_IMPLEMENTED` | CRITICAL→HIGH | No async job model/producer exists ⇒ classify async processing NOT_ENABLED_FOR_INITIAL_RELEASE; worker runs dormant (no crash-loop) + real handler-registry seam | `src/worker/index.ts`, `src/platform/jobs/registry.ts` (new) | none | `tests/unit/job-handler-registry.test.ts` | **RESOLVED (honest)** | If async jobs are later required, dormant processor must be replaced by a claiming loop |
| **H-1** DomainEventOutbox inert (no producer/consumer) | HIGH | Option B — dormant/future; not presented as operational (no nav/consumer today) | none (already inert) | none | integrity check #14 expects 0 rows | **CLASSIFIED (dormant)** | Outbox model retained for future; must not be advertised as delivered eventing |
| **H-2** Notifications: no UI, no email, only org-lifecycle trigger | HIGH | Option B for initial release — FOUNDATION_ONLY; email `NOT_ENABLED_FOR_INITIAL_RELEASE`; no misleading UI exposed (no nav bell exists) | none | integrity check #15 | **CLASSIFIED (foundation-only)** | In-app notification center + core-workflow producers required before advertising notifications |
| **H-3** Institutional Audits complete but not navigable | HIGH | DEFER exposure — no `'audits'` permission module exists; exposure needs product confirmation + entitlement, not a defect fix | none | n/a | **DEFERRED (documented)** | Complete workflow remains unreachable by design until product owner confirms institutional use + a permission module is added |
| **H-4** Three parallel procurement implementations | HIGH | Canonicalize on `CompraOrden`; `CompraSolicitud`=DEPRECATED (retain read-only history), `CompraOrden*Legacy`=DEAD | doc: `procurement-canonicalization.md` (+ C-1 code) | legacy model drop deferred to reviewed migration | shares C-1 test | **RESOLVED (defined) / cleanup DEFERRED** | Dead `*Legacy` models still in schema (harmless); deprecation JSDoc + drop migration pending |
| **H-5** Report export engine has no CSV/XLSX output | HIGH | Built reusable CSV+XLSX exporters (formula-injection-safe, numeric-preserving); wired real canonical Purchase Order Summary export (endpoint + buttons). Other catalog reports have no data handler and stay unsupported | `src/platform/reporting/export/*`, `src/app/api/compras/reportes/export/route.ts`, `src/lib/compras/reportes/purchase-order-export.ts`, `src/app/compras/reportes/page.tsx` | none | `tests/unit/report-export.test.ts` (15) | **PARTIALLY RESOLVED** | ~9 catalog reports still lack data-query handlers → not exportable; catalog advertises formats those reports cannot produce (surfaced only via unused `/api/reports/catalog`) |
| **H-6** Org/Platform admin + Integrations APIs without UI | HIGH | Internal app — classify: Org admin = TECHNICAL_ADMIN_ONLY; Platform admin = FUTURE; Integrations = FOUNDATION_ONLY. No SaaS UI built | none | n/a | **CLASSIFIED** | Must not be presented as operational; expose only when an adapter is live |
| **M-1** Single active assignment app-only (no DB constraint) | MEDIUM | Reviewed SQL migration adds partial unique index + refuse-on-duplicate guard; P2002 mapped to EQUIPMENT_ALREADY_ASSIGNED (create + swap); real gated concurrency tests; live read-only sweep confirmed 0 existing duplicates | `prisma/migrations/20260803120000_equipment_assignment_active_unique/migration.sql`, `src/modules/equipment/assignment-errors.ts`, `src/app/api/equipment-assignments/route.ts`, `.../swap/route.ts` | **20260803120000** (partial unique index) | `tests/contracts/assignment-active-unique.test.ts` (5), `tests/integration/equipment-assignment-constraint.test.ts` (7, gated) | **RESOLVED (deploy pending)** | DB guarantee is active only after `prisma migrate deploy` on staging/prod; until then app-level check remains sole guard |
| **M-2** Dual RBAC (global Role enforced, OrganizationRole unused) | MEDIUM | Keep enforced global `Role`; org RBAC = future | none | none | n/a | **CLASSIFIED** | Two role models coexist; document single source of enforcement |
| **M-3 / M-4** Proveedores & Maintenance hidden from nav | MEDIUM | Navigation reconciliation (13G) — expose when confirmed active | none yet | none | n/a | **DEFERRED** | Discoverability gap remains until nav update |

---

## Decision summary (honest classification labels)

| Capability | Label |
|---|---|
| Purchasing (CompraOrden) | ACTIVE — canonical |
| CompraSolicitud | DEPRECATED (read-only history) |
| CompraOrden*Legacy | DEAD |
| Background async jobs | NOT_ENABLED_FOR_INITIAL_RELEASE (worker dormant) |
| DomainEventOutbox | FOUNDATION_ONLY / dormant |
| Notifications | FOUNDATION_ONLY |
| Email channel | NOT_ENABLED_FOR_INITIAL_RELEASE |
| Institutional Audits | DEFERRED (needs product decision + permission module) |
| Organization admin UI | TECHNICAL_ADMIN_ONLY (no UI) |
| Platform admin UI | FUTURE |
| Integrations | FOUNDATION_ONLY |
| Report CSV/XLSX export | EXPORT_MISSING (pending) |

## Phase 13 · Part 1–3 additions

| Item | Decision | Files / Evidence | Tests | Status |
|---|---|---|---|---|
| **Navigation reconciliation** (M-3/M-4 context) | Sidebar audited: already exposes only ACTIVE modules; **no** notifications/integrations/platform/institutional-audits/dead-legacy-purchase entries. Extracted `NAV_ITEMS` to a testable module and locked the reconciled state. Proveedores & Maintenance exposure left DEFERRED (product decision, not a defect) | `src/components/layout/nav-items.ts`, `src/components/layout/MainLayout.tsx` | `tests/contracts/navigation-reconciliation.test.ts` (5) | **RESOLVED (verified clean)** |
| **Institutional Audits (H-3)** re-review | Still no `'audits'` permission module; not confirmed for institutional use → keep DISABLED, `NOT_ENABLED_FOR_INITIAL_RELEASE` | `src/lib/permissions.ts` (no `audits` module) | nav test asserts it is not exposed | **DEFERRED (documented)** |
| **13A integrity sweep** | Executed READ-ONLY against production Neon | `scripts/remediation/detect-duplicate-active-assignments.sql`, `docs/audit/data-integrity-pre-remediation.*` | — | **EXECUTED — 0 violations (CLEAN)** |

## Remaining P0 to reach GO (see re-audit)
- **None open in code** after C-1 and worker honesty. The two other original P0 items were *decisions*, now made and documented (jobs/outbox/notifications honestly classified; procurement canonicalized).
- Before GO: run the 13A integrity sweep on real data; implement report exports (H-5) and the assignment DB guard (M-1) if the institution requires those modules at go-live.
