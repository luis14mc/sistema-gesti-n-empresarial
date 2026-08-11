# SGE — Internal System Simplification Audit

**Status:** AUDIT ONLY — no code, schema, routes, or tables were changed.
**Date:** 2026-08-11
**Authors (roles):** Senior Software Architect · Senior Systems Auditor · Senior Business Analyst · Senior Full-Stack Engineer
**Guiding principle:** *SGE must be a reliable internal institutional management system for CNI, not a generic SaaS platform.*

> This document classifies existing architecture and proposes a remediation plan.
> **Nothing is to be removed until this plan is approved.** A separate remediation
> pass will execute the approved actions with dependency analysis and migrations.

---

## 0. Executive summary

The SGE codebase is a **modular monolith** (Next.js + Route Handlers → application services → Prisma → PostgreSQL) whose institutional domains are largely functional. However, it carries a **residual SaaS/platform layer** — designed for hypothetical external tenants — that inflates complexity without serving CNI.

**Encouraging finding:** a prior remediation ("Phase 13", see `docs/remediation/audit-remediation-matrix.md`) already did much of the hard containment work:

- The background-**worker runs dormant** and the **job registry is intentionally empty** (`src/platform/jobs/registry.ts`, `src/worker/index.ts`) — no enterprise job platform is active.
- The **sidebar navigation is already institutional** (`src/components/layout/nav-items.ts`) — Platform, Integrations, Notifications, Organizations, Webhooks, Subscriptions are **not exposed**.
- **Legacy/out-of-scope APIs are already tombstoned** to HTTP 410 (`src/lib/deprecated-api.ts`): `/api/tickets`, `/api/time-entries`, `/api/promotional-items`, `/api/purchases`, `/api/compras/solicitudes/*`.
- Many SaaS models named in the audit brief **were never introduced**: `OrganizationModule`, `OrganizationLimit`, `OrganizationUsage`, `ExternalIdentity`, `ExternalSyncRecord`, `WebhookSubscription`, `InboundIntegrationEvent`, `BackgroundJob` — **ABSENT** from `prisma/schema.prisma`.

**What remains** is therefore narrower than the brief anticipated. The live SaaS surface still present:

1. **`DomainEventOutbox`** — model + helper exist, **zero producers, zero consumers** (dead infrastructure).
2. **Integration framework** — full `src/platform/integrations/**` + `OrganizationIntegration`/`IntegrationExecution` + `/api/organizations/current/integrations/**`, with **no real adapter and no confirmed CNI integration**.
3. **Notification platform** — `src/modules/notifications/**` + `Notification`/`NotificationDelivery`, with **exactly one caller**, which is itself the (disabled-surface) organization-lifecycle service.
4. **Platform administration** — `/api/platform/organizations/**` + organization lifecycle service (create/suspend/archive/reactivate/request-closure) + `PlatformRole`, with **no UI**.
5. **Tenant model** — `Organization` / `OrganizationMembership` — **deeply embedded** in ownership and security; must **stay as an internal safety boundary**, not be ripped out.
6. **Duplicate/legacy purchase models** — `CompraSolicitud*` (deprecated) and five `CompraOrden*Legacy` tables shadowing the canonical `CompraOrden`.

**Two required institutional domains are under-finished and out-ranked by the SaaS residue:**

- **Institutional Audits** (`Audit`/`AuditFinding`/`AuditChecklistItem`/`CorrectiveAction`, `/audits`, `/api/audits/**`) — implemented but **not in navigation** and lacking a dedicated permission module. **P1.**
- **Reports** — reporting module + CSV/XLSX export exist; needs canonical data source, filters, totals, and secure download finished. **P1.**

**Complexity scores (Section 18):** Current **7.5 / 10** → Target **4.0 / 10**.

---

## 1. Product boundary (confirmed)

SGE is an **internal cloud application for CNI**. Required functional domains — the priorities — are:

Dashboard · Oficios · Equipment · Equipment assignments · Equipment returns · Maintenance · Equipment disposal · Purchase orders · Suppliers · Employees · Users · Roles & permissions · Institutional audits · Reports · Documents · Configuration · System audit.

Everything below is measured against this boundary. Anything not supporting these workflows is challenged, regardless of code already existing.

---

## 2. Architecture target (confirmed direction)

```
Browser → Next.js → Route Handlers / Server Actions → Application services → Prisma → PostgreSQL
```
Justified add-ons only: **S3/private storage** (documents, PDFs — REQUIRED), **PDF generator** (REQUIRED), **email** (only if institutionally required — currently NOT), **simple worker** (only for genuinely long-running ops — currently NONE, worker stays dormant).

The current codebase already matches this shape. The deviations are the unused event/integration/notification/platform layers, not the request path.

---

## 3. SaaS / platform abstraction inventory & classification

Legend for **Classification**: `REQUIRED` · `KEEP_INTERNAL_ONLY` · `SIMPLIFY` · `DISABLE` · `DEPRECATE` · `REMOVE_LATER`.
"Risk" = risk of removal/disable.

| # | Component | Current purpose | Actual CNI requirement | Classification | Dependencies | Recommended action | Risk | Priority |
|---|-----------|-----------------|------------------------|----------------|--------------|--------------------|------|----------|
| 1 | `Organization` model + `organizationId` scoping | Multi-tenant ownership + security boundary | Single org (CNI); scoping still valuable as isolation guard | **KEEP_INTERNAL_ONLY** | Nearly every model & query; middleware/tenant-scope | Keep column & scoping; hard-default to CNI; hide any selector | **High** (do NOT drop the column now) | P2 |
| 2 | `OrganizationMembership`, `OrganizationRole`, `MembershipStatus` | User↔org membership w/ roles | CNI users are implicitly all in CNI | **KEEP_INTERNAL_ONLY** | Auth/session, permissions | Auto-provision single CNI membership; no membership UI | Medium | P2 |
| 3 | Platform admin: `/api/platform/organizations/**`, `organizationLifecycleService`, `platform-http`, `PlatformRole`, `OrganizationStatus` lifecycle | Create/suspend/archive/reactivate/close orgs | None — CNI is fixed | **DISABLE** | `modules/organizations/application/lifecycle.ts`, platform routes, notification dispatch | Gate routes off (404/403) behind a technical-admin flag; remove from any surface | Low (no UI today) | P1 |
| 4 | Tenant switcher / org selector UI | Choose active org | None | **DISABLE** (already absent) | nav-items | Confirm not rendered anywhere; keep excluded | Low | P2 |
| 5 | Support access / `SecuritySupportStatus` enum | SaaS "log in as tenant" support sessions | None | **REMOVE_LATER** | Enum only; no support-session code found | Leave enum dormant; drop in schema-cleanup pass | Low | P3 |
| 6 | `DomainEventOutbox` + `OutboxStatus` + `appendOutboxEvent()` (`src/platform/events/outbox.ts`) | Reliable async domain-event propagation | **None** — direct transactional services are sufficient | **DISABLE → REMOVE_LATER** | **Zero producers, zero consumers** (verified) | Stop referencing; mark table INFRASTRUCTURE_UNUSED; drop later | Very low | P2 |
| 7 | Job platform: `jobs/registry.ts`, `jobs/dispatcher.ts` (`SynchronousJobDispatcher`), `src/worker/**` | Async background jobs | Only synchronous in-request work today | **KEEP (SIMPLIFY) + worker DISABLE** | Worker container; env `WORKER_*` | Keep `SynchronousJobDispatcher` as the seam; do **not** deploy the worker; registry stays empty | Low (already dormant) | P2 |
| 8 | Integration framework: `src/platform/integrations/**`, `OrganizationIntegration`, `IntegrationExecution`, `IntegrationCapability/Status`, `/api/organizations/current/integrations/**` | Generic external REST/provider integration w/ secrets, circuit breaker, SSRF guard | **None** — no confirmed CNI integration | **DISABLE** | 4 API routes; integration services; secret store | Turn off routes; keep code parked & documented; no admin UI | Low (no UI) | P1 |
| 9 | Notification platform: `src/modules/notifications/**`, `Notification`, `NotificationDelivery`, `/api/notifications/**`, channels/email seam | Multi-channel (in-app + email) notifications | Only a few genuine institutional events; email not required for v1 | **SIMPLIFY / DISABLE** | **One caller** = `organizations/application/lifecycle.ts` (disabled surface) | Disable multi-channel/email; keep a minimal in-app seam only if a real event is prioritized | Low | P2 |
| 10 | `ReportExecution` + reporting module (`src/modules/reporting/**`) | Report catalog + async execution + CSV/XLSX export | **REQUIRED** (institutional reports) but finish, don't abstract | **REQUIRED (SIMPLIFY)** | `/api/reports/catalog`, `/api/compras/reportes` | Finish concrete reports; drop async-execution ceremony if unused | Medium | P1 |
| 11 | Billing / subscription / usage metering / feature flags | — | None | **ABSENT** (never built) | — | Nothing to do | — | — |
| 12 | Webhooks / external identity / inbound events / provider adapters | — | None | **ABSENT** (never built) | — | Nothing to do | — | — |

---

## 4. Organization model — decision

**Decision: `KEEP_INTERNAL_ONLY`.** `Organization`/`organizationId` is deeply embedded in database ownership and tenant security (it is the isolation boundary enforced across middleware, tenant-scope helpers, and virtually every query). Removing it now would be a **dangerous, high-blast-radius migration** with negative simplicity ROI.

Instead:
- CNI is the **default and only** organization; bootstrap/backfill scripts already exist (`scripts/bootstrap-default-organization.ts`, `scripts/backfill-default-organization.ts`).
- Normal users **never choose** an organization; the selector stays hidden.
- Organization **lifecycle UI** and **platform organization management** are **disabled** (item #3).
- Tenant scoping **remains internally** as a safety boundary (defense-in-depth against IDOR — note `/api/compras/solicitudes/*` was disabled precisely because its legacy model lacked `organizationId`).

A future, separately-approved simplification *may* collapse tenancy, but that is **out of scope for this pass** and explicitly **not** to be attempted now.

---

## 5. API architecture classification

Route Handlers are the correct internal API layer and are **kept**. No public-API product, API-key management, generic webhook platform, or generic integration framework is to be built. New simple UI-only mutations may use Server Actions (`src/actions/` already exists), but **stable Route Handlers are not to be rewritten** without measurable benefit.

| Route group | Classification | Note |
|-------------|----------------|------|
| `/api/oficios/**`, `/api/equipment/**`, `/api/equipment-assignments/**`, `/api/equipment-disposal/**`, `/api/maintenance/**`, `/api/compras/ordenes/**`, `/api/compras/proveedores`, `/api/employees/**`, `/api/users/**`, `/api/auth/**`, `/api/audit-logs`, `/api/health/**` | **INTERNAL_REQUIRED** | Core institutional workflows |
| `/api/audits/**`, `/api/corrective-actions/**` | **INTERNAL_REQUIRED (finish)** | Institutional audits — wire nav + permissions (§12) |
| `/api/compras/reportes/**`, `/api/reports/catalog` | **INTERNAL_REQUIRED (finish)** | Reports (§13) |
| `/api/purchases/**`, `/api/compras/solicitudes/**` | **LEGACY** (already 410) | Superseded by `/api/compras/ordenes/**` |
| `/api/tickets/**`, `/api/time-entries/**`, `/api/promotional-items/**` | **LEGACY** (already 410) | Out-of-scope domains |
| `/api/platform/organizations/**` | **DISABLE** | Platform admin (§10) |
| `/api/organizations/current/integrations/**` | **DISABLE** | Integration framework (§9) |
| `/api/notifications/**` | **INTERNAL_REDUNDANT** | No producing events for v1 (§8) |

---

## 6. Jobs

| Job path | Producer | Consumer | Use case | Runtime need | Verdict |
|----------|----------|----------|----------|--------------|---------|
| `SynchronousJobDispatcher` | in-request callers | same request | run work synchronously | in-process | **KEEP** (the honest seam) |
| `jobHandlerRegistry` | none | worker | — | none | **KEEP empty** |
| `src/worker/**` | — | — | dormant | none | **DISABLE** — do not deploy |

There is **no persistent async job model and no async producers**. This is already the state. Legitimate future async candidates (large export/import, long PDF, scheduled maintenance) should be added **one concrete handler at a time**, not by reviving a generic platform.

---

## 7. Outbox

`DomainEventOutbox` has **no concrete business requirement** and **zero code paths write or read it** (`appendOutboxEvent` is uncalled; no consumer exists). Event-driven propagation is not needed — **direct transactional application services are the accepted pattern** for this system.

**Classification: `DISABLE` now → `REMOVE_LATER`** (drop table in the schema-cleanup pass after confirming no historical rows are relied upon).

---

## 8. Notifications

Real institutional notification needs are few (e.g., *disposal awaiting approval*, *equipment assignment*, *overdue oficio*, *report ready*). The current platform is multi-channel (in-app + email seam) but has **exactly one caller** — the organization-lifecycle service, whose surface is itself being disabled.

**Classification: `SIMPLIFY / DISABLE`.** Disable email/multi-channel for the initial release. If a specific event (e.g. disposal approval) is prioritized, keep a **minimal in-app** notification only. Do not maintain a multi-channel platform for architectural completeness.

---

## 9. Integrations

No confirmed CNI integration exists. The full generic framework (`connection-service`, `execution-service`, `circuit-breaker`, `retry-policy`, `ssrf-guard`, `secret-service`, registry, HTTP presentation) plus `OrganizationIntegration`/`IntegrationExecution` and four API routes are **DISABLE**.

Future integrations (Microsoft 365 / SharePoint / SMTP) may be **documented as candidates** but must **not** be exposed as administration UI, generic webhooks, or generic REST-provider infrastructure until a real requirement lands — and then as a **specific** adapter, not a framework.

---

## 10. Platform administration

CNI does not need a commercial SaaS console. Audit result:

| Surface | State | Action |
|---------|-------|--------|
| `/platform` UI | not present | keep absent |
| `/api/platform/organizations/**` (activate/suspend/archive/reactivate/request-closure) | implemented, no UI | **DISABLE** (gate behind technical-admin flag or 404) |
| Organization quotas / usage metering | **ABSENT** | none |
| Support sessions | **ABSENT** (enum only) | none |

Dependency analysis required before deletion — disable first.

---

## 11. Feature priority (redirect effort here)

- **P0 — correctness / integrity:** confirm canonical procurement source (`CompraOrden`) is the *only* source for purchase metrics (memory: [[procurement-canonical-model]]); ensure disposal/oficio/equipment workflows are transactionally correct; verify tenant scoping on every read.
- **P1 — incomplete required modules:** finish **Institutional Audits** (nav + permissions), finish **Reports** (filters/totals/secure export), disable platform/integration/notification residue so it stops competing for attention.
- **P2 — UX / convenience / future integrations.**

---

## 12. Institutional Audits (raise to operational)

The module **exists and is CNI-relevant**: models `Audit`, `AuditFinding`, `AuditChecklistItem`, `CorrectiveAction`; routes `/api/audits/**`, `/api/corrective-actions/**`; pages `/audits`, `/audits/[id]`. But it is **not in the sidebar** and has **no dedicated permission module** (nav comment marks it `NOT_ENABLED_FOR_INITIAL_RELEASE`).

**Action (P1):** add an `audits` permission `Module`, wire it into RBAC, add a **Control → Auditoría institucional** nav entry, and finish navigation/permissions so it is operational. **This outranks all SaaS/platform infrastructure work.**

> Note: distinguish three "audit" concepts that currently coexist — **Institutional audit** (`Audit*`, the module above), **System audit log** (`SystemAuditEvent` / security events, surfaced today as "Auditoría" → `/audit/logs`), and the legacy **`AuditRecord`** (HR/attendance-adjacent, out of scope). Keep the first two; treat `AuditRecord` as legacy.

---

## 13. Reports (finish, don't abstract)

Keep concrete institutional reports; drop abstract report-platform ceremony if unused.

Priorities: **canonical data source** (`CompraOrden` for procurement — verified `src/app/api/compras/reportes/route.ts` already reads `compraOrden`), **filters**, **totals**, **PDF/CSV/XLSX only where truly required** (CSV/XLSX exporters exist in `src/platform/reporting/export/**`), **secure download**, **usable output**. If `ReportExecution` async execution has no real consumer, collapse it to synchronous query+export.

---

## 14. Database schema classification

Legend: `ACTIVE` · `LEGACY_READ_ONLY` · `INFRASTRUCTURE_UNUSED` · `DEPRECATED`. **No table is to be dropped in this pass.** Deletion is proposed only after confirming (a) no active code dependency, (b) no historical data dependency, (c) no migration dependency.

| Model / group | Classification | Rationale | Deletion pre-conditions |
|---------------|----------------|-----------|-------------------------|
| Core domain: `Oficio*`, `Equipment*`, `EquipmentAssignment`, `EquipmentMaintenance`, `EquipmentDisposal*`, `DisposalDocument`, `CompraOrden` (+ `Item`/`Documento`/`Historial`/`Sequence`/`Template`), `Proveedor`, `Employee`, `User`, `Department`, `CostCenter`, `DocumentSequence` | **ACTIVE** | Institutional workflows | — keep |
| Institutional audit: `Audit`, `AuditFinding`, `AuditChecklistItem`, `CorrectiveAction` | **ACTIVE (finish wiring)** | Required domain (§12) | — keep |
| Tenancy: `Organization`, `OrganizationMembership` | **ACTIVE (internal-only)** | Safety boundary (§4) | do not drop |
| System audit: `SystemAuditEvent` | **ACTIVE** | Security/system audit log | — keep |
| **Duplicate procurement:** `CompraSolicitud`, `CompraSolicitudItem` | **DEPRECATED** | APIs 410; canonical = `CompraOrden`; only ref in `src/lib/compras/service.ts` | remove reads → verify no historical dependency → drop |
| **Legacy procurement:** `CompraOrdenLegacy`, `CompraOrdenItemLegacy`, `CompraOrdenDocumentoLegacy`, `CompraOrdenHistorialLegacy`, `CompraOrdenSequenceLegacy` | **LEGACY_READ_ONLY** | Shadow the canonical `CompraOrden*` | confirm migration path / no reads → drop |
| **Event infra:** `DomainEventOutbox` | **INFRASTRUCTURE_UNUSED** | Zero producers/consumers (§7) | drop after confirming no rows relied upon |
| **Integration infra:** `OrganizationIntegration`, `IntegrationExecution` | **INFRASTRUCTURE_UNUSED** | No adapter/consumer (§9) | disable routes → drop |
| **Notification infra:** `Notification`, `NotificationDelivery` | **INFRASTRUCTURE_UNUSED (v1)** | One caller, itself disabled (§8) | keep minimal seam or drop |
| **Reporting:** `ReportExecution` | **ACTIVE (review)** | Keep if execution is real; else collapse | — |
| **Out-of-scope domains:** `Ticket`, `TimeEntry`, `AttendancePolicy`, `AuditRecord`, `PromotionalItem`, `PromotionalMovement`, `JobPosition`, `ReplacementProjection` | **DEPRECATED** | Not in the 17 required domains; APIs already 410 where present; `jobPosition` has 0 code refs | confirm no reads / no reports depend → drop |
| Support enum `SecuritySupportStatus` | **DEPRECATED** | SaaS support-session vestige | drop with schema cleanup |

---

## 15. UI simplification

Current nav (`src/components/layout/nav-items.ts`) is already close to target and correctly **excludes** Platform, Integrations, Usage, Subscriptions, Organizations, Support, Webhooks. Remaining gaps vs. the target IA:

- **Institutional Audits** is missing → add under **Control** (§12).
- **Oficios** grouping is good; labels differ slightly from the target ("Externos CNI/Despacho" vs "Oficios CNI/Despacho") — cosmetic, optional.
- **Compras** "Órdenes de compra" currently hrefs to `/compras/solicitudes` (a **page** that renders canonical `CompraOrden`; the *API* `solicitudes` is 410). The naming is confusing and should be renamed to `ordenes` in a later pass for clarity — **not** urgent, purely cosmetic.
- Consider grouping into the target sections **Inicio / Correspondencia / Activos / Compras / Personas / Control / Administración** for institutional legibility.

No architecture-oriented items (Platform/Integrations/Usage/etc.) are to be added.

---

## 16. Simplicity rules applied

**Applied:** YAGNI (outbox/integration/notification unused → disable), KISS (synchronous services over event-driven), single source of truth (`CompraOrden` canonical), modular monolith (kept), explicit domain services (kept), database integrity (tenant scoping retained). **Avoided:** premature microservices, event-driven-without-need (outbox), generic provider frameworks (integrations), SaaS abstractions (platform/billing), duplicate models (Compra legacy/solicitud flagged), unused infrastructure (worker dormant, registry empty).

---

## 17. Deliverables

- This file: `docs/audit/internal-system-simplification.md`
- Machine-readable: `docs/audit/internal-system-simplification.json`

---

## 18. Final architecture recommendation

### Complexity scoring model

Score = weighted count of active-but-unjustified abstraction layers, duplicate models, and exposed platform surfaces (0 = pure institutional monolith, 10 = full SaaS platform).

| Dimension | Current | Target |
|-----------|:------:|:-----:|
| Tenancy exposure (multi-org UI/lifecycle) | 1.5 | 0.5 (internal-only) |
| Event-driven infra (outbox) | 1.0 | 0.0 |
| Async/job platform | 0.5 | 0.25 (dormant seam) |
| Integration framework | 1.5 | 0.0 |
| Notification platform | 1.0 | 0.25 (minimal seam) |
| Platform admin surface | 1.0 | 0.0 |
| Duplicate/legacy data models | 1.0 | 0.25 |
| **CURRENT ARCHITECTURE COMPLEXITY SCORE** | **7.5 / 10** | |
| **TARGET ARCHITECTURE COMPLEXITY SCORE** | | **4.0 / 10** |

> Target is not 0: tenancy scoping is retained deliberately as a safety boundary, and a dormant synchronous-dispatch seam is kept for future genuine async needs.

### Platform-infrastructure disposition

| Infrastructure | Verdict |
|----------------|---------|
| `Organization` / `OrganizationMembership` tenancy & scoping | **KEEP** (internal-only) |
| `SynchronousJobDispatcher` seam | **KEEP** |
| Route Handlers, PDF, S3 storage, PDF/CSV/XLSX export | **KEEP** |
| Notification platform (multi-channel/email) | **SIMPLIFY** → minimal in-app or disable |
| Reporting async execution ceremony | **SIMPLIFY** (collapse if no consumer) |
| Compras legacy/solicitud duplicate models | **SIMPLIFY** → single source `CompraOrden` |
| Platform admin (`/api/platform/**`, org lifecycle) | **DISABLE** |
| Integration framework + routes | **DISABLE** |
| Background worker (deployment) | **DISABLE** (dormant) |
| `/api/notifications/**` (no producers) | **DISABLE** |
| `DomainEventOutbox` | **REMOVE LATER** |
| `SecuritySupportStatus`, legacy `CompraOrden*Legacy`, `Ticket`/`TimeEntry`/`AttendancePolicy`/`AuditRecord`/`PromotionalItem`/`JobPosition`/`ReplacementProjection` | **REMOVE LATER** (after dependency confirmation) |

---

## 19. Scope guard

This first pass is **AUDIT ONLY**. No tables removed, no routes deleted, no schema changed, no modules rewritten. **Await approval of the remediation plan before any code change.** The remediation pass will proceed in the order: (1) finish P1 institutional gaps (Audits nav+permissions, Reports), (2) DISABLE platform/integration/notification/worker surfaces, (3) SIMPLIFY duplicate procurement to a single source, (4) REMOVE_LATER dead tables after dependency + data + migration confirmation.
