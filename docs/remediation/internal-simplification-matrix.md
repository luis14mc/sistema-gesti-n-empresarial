# Phase 14 — Internal Simplification Matrix

Execution tracker for Phase 14 (Internal System Simplification and Functional Closure).
Source of truth: [`docs/audit/internal-system-simplification.md`](../audit/internal-system-simplification.md) + [`docs/remediation/audit-remediation-matrix.md`](audit-remediation-matrix.md).

**Classification legend:** `KEEP` · `SIMPLIFY` · `DISABLE` · `REMOVE_LATER` · `DEPRECATED` · `FOUNDATION_ONLY`.
**Status legend:** ☐ pending · ◐ in progress · ☑ done · ⏸ deferred (documented).

> Guardrails (all subphases): do not remove `organizationId` blindly · do not drop schema before dependency analysis · do not rewrite working modules · disable runtime + UI before any deletion.

---

## Subphase status

| Subphase | Scope | Status |
|----------|-------|--------|
| **14A** | Navigation & visible-surface cleanup | ☑ done |
| **14B** | Organization/platform simplification (CNI auto-select, 409 removed) | ☑ done |
| **14C** | Disable unused SaaS foundations (integrations, platform admin) | ☑ done (runtime 404 via `FEATURES`) |
| **14D** | Worker/outbox/notifications simplification | ☑ done (notifications 404; outbox/worker dormant) |
| **14E** | Database/schema deprecation classification | ☑ done (classification only; no destructive migration) |
| **14F** | Institutional Audits functional closure | ☑ done (Maintenance UI + full Reports remain P1) |
| **14G** | Functional re-audit (score) | ☑ done — see [phase14-reaudit](../audit/functional-system-audit-phase14-reaudit.md) (~80%) |

**Feature gates (default off):** `SGE_ENABLE_PLATFORM_ADMIN`, `SGE_ENABLE_INTEGRATIONS`, `SGE_ENABLE_NOTIFICATIONS` — see `src/platform/config/features.ts`.
**Remaining P1 (14F follow-up):** Maintenance UI page · Reports catalog completion · assignment-constraint `migrate deploy`.

---

## 14A — Navigation & visible-surface cleanup ☑

Most of the SaaS-surface removal was already done in Phase 13 (verified). Remaining 14A deltas executed:

| Item | Finding | Action | Status |
|------|---------|--------|--------|
| Organization selector | Not present in `MainLayout` | Verified absent — no change | ☑ |
| Platform / Organizations / Usage / Limits / Support nav | Not present (sidebar driven only by `NAV_ITEMS`) | Verified absent | ☑ |
| Integrations nav | Not present | Verified absent | ☑ |
| Notifications UI (bell/center) | Not present | Verified absent | ☑ |
| Institutional Audits `/audits` | Implemented but no `audits` permission module | **Keep DISABLED** in nav; expose in 14F after functional verification | ⏸ |
| Maintenance `/maintenance` | API exists, **no page** | Keep out of nav until page exists (14F) | ⏸ |
| Proveedores | Operational page `/compras/proveedores` **missing from nav** (deferred M-3) | **Added** to Compras submenu | ☑ |
| Institutional IA grouping | Flat nav | **Restructured** to target IA: Correspondencia · Activos · Compras · Personas · Control · Administración; added per-child module gating | ☑ |
| `/compras/solicitudes` label | URL says "solicitudes" but page renders canonical `CompraOrden` (`useCompraOrdenes`) | Operational — route rename **deferred** (cross-cutting: middleware, `ROUTE_PATH_TO_MODULE`, links). Labeled "Órdenes de compra" | ⏸ |
| Placeholder pages | Scan for "coming soon / próximamente / not implemented" | None found (only form input `placeholder=`) | ☑ |
| Legacy `/purchases`, `/api/purchases`, `/api/compras/solicitudes/*` | Already 410/redirect | No nav entry (guarded by test) | ☑ |

**Files:** `src/components/layout/nav-items.ts`, `src/components/layout/MainLayout.tsx`, `tests/contracts/navigation-reconciliation.test.ts`.
**Verification:** nav test 5/5 · contracts 35/35 · `tsc --noEmit` clean · eslint 0 errors (1 pre-existing warning) · `next build` + worker bundle pass.
**No database models were touched.**

---

## 14B — Organization / platform simplification ☐

| Item | Target | Notes |
|------|--------|-------|
| `requireOrganizationContext()` | Auto-resolve CNI for standard users; drop `409 ORGANIZATION_SELECTION_REQUIRED` from the normal flow if no real multi-org user exists | Preserve membership + permission validation; safe admin fallback |
| Org switcher / provisioning / lifecycle UI | Not exposed | Already absent in UI; ensure API surface not reachable by normal roles |
| `organizationId` | **KEEP_INTERNAL_ONLY** | No removal migration |
| Platform admin routes `/api/platform/organizations/**` | DISABLE (gate behind technical-admin flag or 404) | Dependency analysis first |

## 14C — Disable unused SaaS foundations ☐

Integrations (`src/platform/integrations/**`, `/api/organizations/current/integrations/**`, `OrganizationIntegration`, `IntegrationExecution`), support access (`SecuritySupportStatus`), usage/limits (ABSENT from schema — nothing to disable). Disable runtime + routes; keep schema.

## 14D — Worker / outbox / notifications ☐

- Worker already dormant, registry empty — **KEEP** the synchronous seam; add real handlers only when a genuine long-running job appears (GENERATE_REPORT, LARGE_EXPORT, IMPORT_OFFICES).
- `DomainEventOutbox`: **zero producers/consumers** — keep dormant, do not write records; `REMOVE_LATER`.
- Notifications: one caller (org-lifecycle, itself disabled) — DISABLE `/api/notifications/**` UI/runtime; keep minimal in-app seam only if a real event (e.g. disposal pending approval) is prioritized.

## 14E — Schema deprecation ☐

See [`docs/architecture/schema-classification.md`](../architecture/schema-classification.md). Prefer deprecation → legacy-read-only → destructive delete, with tested migration + rollback.

## 14F — Institutional modules functional closure ☐

Priority order (§20): Institutional Audits (add `audits` module + nav + verify CRUD/findings/actions/reports), Maintenance (build page + nav), Reports (finish concrete reports/exports), assignments DB constraint deploy, documents.

## 14G — Functional re-audit ☐

Repeat Phase 12 methodology. Baseline **67%**. Count only operational institutional functionality; do not inflate by removing features.
