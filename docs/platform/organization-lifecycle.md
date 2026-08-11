# Phase 7A — Organization lifecycle foundation

Status: Phase 7A delivers the minimum-viable lifecycle for organizations as
independent SaaS tenants. Future subphases (7B – 7G) extend it with
membership administration, module entitlements, settings, limits, support
access, exports and closure workflows.

## Goals

1. Make organization lifecycle states explicit and auditable.
2. Keep the existing CNI organization operational without forcing a re-onboarding.
3. Separate **platform administration** (`/api/platform/...`) from
   **organization administration** (`/api/organizations/...`).
4. Emit immutable platform audit events for every lifecycle transition.
5. Block forbidden transitions at the domain layer.

## Lifecycle states

| State              | Meaning                                                         | Reachable from                         |
| ------------------ | --------------------------------------------------------------- | -------------------------------------- |
| `PROVISIONING`     | Tenant created but not yet ready for operation.                 | (initial)                               |
| `ACTIVE`           | Normal operational state.                                       | `PROVISIONING`, `SUSPENDED`, `ARCHIVED` |
| `SUSPENDED`        | Tenant blocked from business writes; data preserved.            | `ACTIVE`                                |
| `ARCHIVED`         | Long-term inactive, read-only by default.                       | `PROVISIONING`, `ACTIVE`, `SUSPENDED`  |
| `PENDING_DELETION` | Closure requested; data preserved for the closure workflow.     | `PROVISIONING`, `ACTIVE`, `SUSPENDED`, `ARCHIVED` |
| `INACTIVE`         | Legacy fallback kept for back-compat. Treated as archived.      | existing rows only                      |

`PENDING_DELETION` is a terminal state for the lifecycle API; deletion
itself is executed by the closure workflow (Phase 7G).

`ARCHIVED → ACTIVE` requires `PLATFORM_ADMIN`.

## Allowed transitions

```text
PROVISIONING  → ACTIVE | ARCHIVED | PENDING_DELETION
ACTIVE        → SUSPENDED | ARCHIVED | PENDING_DELETION
SUSPENDED     → ACTIVE | ARCHIVED | PENDING_DELETION
ARCHIVED      → ACTIVE (platform) | PENDING_DELETION
PENDING_DELETION → ∅
```

The matrix is enforced by
`src/modules/organizations/domain/rules.ts#assertOrganizationTransition`.
Any forbidden transition raises `InvalidOrganizationTransitionError`.

## Owner protection

Every active organization must have at least one active owner.

* Activation without an active owner is rejected with
  `LAST_OWNER_REQUIRED`-flavored error.
* Suspension and reactivation are audited; removal of the last owner
  will be enforced by Phase 7B.
* `assertCanRemoveOwner` is the single place to update when we add
  ownership transfer (Phase 7B).

## Audit events

Every lifecycle operation writes to `system_audit_events` with one of the
following event types:

| Event                                    | Outcome   |
| ---------------------------------------- | --------- |
| `organization.lifecycle.created`         | `SUCCESS` |
| `organization.lifecycle.activated`        | `SUCCESS` / `DENIED` |
| `organization.lifecycle.suspended`        | `SUCCESS` / `DENIED` |
| `organization.lifecycle.reactivated`      | `SUCCESS` / `DENIED` |
| `organization.lifecycle.archived`         | `SUCCESS` / `DENIED` |
| `organization.lifecycle.closure_requested` | `SUCCESS` / `DENIED` |

`DENIED` events are emitted with severity `WARNING`. Successful events
include the `from`/`to` states, the reason (where applicable), the
performer (`userId`) and the `requestId`.

## Platform administration

All commands live under `/api/platform/...` and are guarded by
`requirePlatformContext`, which only admits users with
`User.platformRole` set.

| Method | Path                                              | Purpose                              |
| ------ | ------------------------------------------------- | ------------------------------------ |
| GET    | `/api/platform/organizations`                     | List tenants with status filters.    |
| POST   | `/api/platform/organizations`                     | Provision a new tenant.              |
| GET    | `/api/platform/organizations/[id]`                | Inspect a tenant + recent audit.     |
| POST   | `/api/platform/organizations/[id]/activate`       | Move `PROVISIONING → ACTIVE`.        |
| POST   | `/api/platform/organizations/[id]/suspend`        | Move `ACTIVE → SUSPENDED`.           |
| POST   | `/api/platform/organizations/[id]/reactivate`     | Move `SUSPENDED → ACTIVE`.           |
| POST   | `/api/platform/organizations/[id]/archive`        | Move to `ARCHIVED`.                  |
| POST   | `/api/platform/organizations/[id]/request-closure` | Move to `PENDING_DELETION`.         |

The lifecycle does **not** expose a generic PATCH endpoint to mutate
status. Each command encodes its allowed `from` state, its reason
requirement, and its audit semantics.

## Tenant isolation invariants

* `requireOrganizationContext` keeps enforcing `Organization.status === 'ACTIVE'`
  for normal application routes; suspended/archived tenants receive
  `OrganizationSuspendedError` / `OrganizationArchivedError` when their
  context is requested.
* Platform routes operate outside the tenant context. They must never
  write tenant-scoped business data.
* The lifecycle API **never** deletes an organization. Hard deletion is
  reserved for Phase 7G's closure workflow.

## Outstanding risks

* `Worker is disabled` (Phase 5 placeholder) — audit events are written
  synchronously inside the lifecycle transaction; this is intentional
  for immutability but should be re-evaluated once the worker is
  implemented.
* Membership management (invitations, suspensions, last-owner enforcement
  during membership writes) lands in Phase 7B and is not yet enforced
  by the lifecycle service.
* `ARCHIVED → ACTIVE` is currently allowed for any platform admin; a
  secondary confirmation step will be added in Phase 7B together with
  ownership transfer.
