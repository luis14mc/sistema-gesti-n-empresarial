# Phase 14G — Functional Re-Audit

Methodology mirrors the Phase 12 functional audit. **Only operational institutional functionality is counted.** Architectural simplification (disabling foundations) is **not** rewarded as functional gain — a disabled foundation is neutral, not positive.

**Baseline (pre-Phase-14): 67%**
**Post-Phase-14 (this pass): ~80%**

The gain comes from **exposing/closing real institutional functionality** (Institutional Audits, Suppliers, navigation reconciliation, removal of the org-selection blocker), not from removals.

---

## Module operational status (17 required domains)

| # | Domain | Status | Notes / evidence |
|---|--------|--------|------------------|
| 1 | Dashboard | ✅ Operational | Reads canonical `CompraOrden` (C-1) |
| 2 | Oficios | ✅ Operational | CRUD, tracking, import batches, documents |
| 3 | Equipment | ✅ Operational | CRUD, history, stats |
| 4 | Equipment Assignments | ✅ Operational | App guard live; DB partial-unique index **pending `migrate deploy`** |
| 5 | Equipment Returns | ✅ Operational | `/api/equipment-assignments/[id]/return` |
| 6 | Maintenance | ⛔ Not operational (UI) | `/api/maintenance` exists, **no page** — remaining P1 |
| 7 | Equipment Disposal | ✅ Operational | Workflow, PDF, evidence documents |
| 8 | Purchase Orders | ✅ Operational | Canonical `CompraOrden`, full lifecycle |
| 9 | Suppliers | ✅ Operational | Page now **exposed in nav** (was hidden — 14A) |
| 10 | Employees | ✅ Operational | CRUD, tenant-scoped |
| 11 | Users | ✅ Operational | CRUD, RBAC |
| 12 | Roles & Permissions | ✅ Operational | `lib/permissions` single source; middleware + nav |
| 13 | Institutional Audits | ✅ **Newly operational** | Exposed under Control; `audits` module (ADMIN); list/create + checklist/findings/corrective-actions detail |
| 14 | Reports | ◐ Partial | Purchase Order Summary export (CSV/XLSX) works; ~9 catalog reports lack data handlers — remaining P1 |
| 15 | Documents | ✅ Operational | Attachments across oficios/equipment/disposal/compras + secure download |
| 16 | Configuration | ✅ Operational | Settings + compras template |
| 17 | System Audit | ✅ Operational | `/audit/logs`, `SystemAuditEvent`, security events |

**Tally:** 15 fully operational · 1 partial (Reports ≈ 0.5) · 1 not operational (Maintenance UI).
Score = (15 + 0.5) / 17 ≈ **91%** of domains have working UI, but weighting the two open P1s (Maintenance UI, full Reports) and the pending assignment-constraint deploy against production-readiness yields a conservative **~80%** operational rating.

---

## What changed in Phase 14

| Subphase | Outcome |
|----------|---------|
| 14A | Institutional IA navigation; Suppliers exposed; placeholder scan clean; audits/maintenance decisions recorded |
| 14B | `requireOrganizationContext` auto-resolves the primary CNI membership; **409 `ORGANIZATION_SELECTION_REQUIRED` removed** from the normal flow; tenant guards intact; `organizationId` untouched |
| 14C | Integration framework **disabled at runtime** (404) via `FEATURES.integrations`; no routes/schema deleted |
| 14C/B | Platform admin **disabled at runtime** (404) via `FEATURES.platformAdmin` |
| 14D | Notifications **disabled at runtime** (404) via `FEATURES.notifications`; outbox confirmed dormant (0 producers); worker stays dormant |
| 14E | Schema deprecation **classification only** (`schema-classification.md`); no destructive migration; procurement canonical (`CompraOrden`) preserved |
| 14F | Institutional Audits closed to operational: `audits` permission module (ADMIN) + route protection + nav; API verified tenant-scoped |

## Foundations disabled (neutral — not counted as functionality)

Platform admin · Integrations · Notifications · Outbox · Async job worker. All reachable only behind explicit env flags (`SGE_ENABLE_*`), default off. See [`disabled-foundations.md`](../architecture/disabled-foundations.md).

## Remaining work to raise the score

- **P1 — Maintenance UI**: build `/maintenance` page over the existing API (+ nav under Activos).
- **P1 — Reports**: add data handlers for the remaining catalog reports or prune the catalog to what is operational.
- **P1 — Assignment DB constraint**: run `prisma migrate deploy` (partial-unique index) on staging/prod.
- **P2**: route rename `/compras/solicitudes` → `/compras/ordenes` (cosmetic; cross-cutting).

## Production recommendation

The system is **operationally sound for the core institutional workflows** with tenant isolation, RBAC, and canonical procurement intact. The SaaS surface is no longer exposed. **Go-live is gated on the three P1 items above** (Maintenance UI, Reports completion, assignment-constraint deploy). Proceed to those before final go-live hardening.

**Verification (this pass):** vitest 938 passed / 1 skipped · `tsc --noEmit` clean · eslint 0 errors · `next build` + worker bundle pass.
