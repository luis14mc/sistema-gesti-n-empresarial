# Organization RBAC and tenant isolation

SGE authorization is based on an authenticated identity, an active organization membership, a server-selected organization, and an explicit capability. Navigation visibility and legacy JWT roles are not authorization boundaries.

## Identity layers

- `User` is the platform identity and credential owner.
- `User.platformRole` is optional and limited to `PLATFORM_ADMIN` or `SUPPORT_ADMIN`.
- `OrganizationMembership` grants tenant access and carries one organization role.
- `User.role` is a legacy compatibility field. It must not grant organization capabilities or platform authority in new code.

No legacy `ADMIN` is migrated automatically to `PLATFORM_ADMIN`. Platform roles do not bypass organization membership or tenant scope.

## RBAC configurable: official template, active matrix, user exceptions

Organization capabilities remain **RBAC**: permissions attach to **roles**; users inherit from `OrganizationMembership.role` plus optional `UserPermissionOverride` rows (`ALLOW` | `DENY`).

| Layer | Source | Purpose |
|-------|--------|---------|
| Official template | `OFFICIAL_ROLE_PERMISSIONS` in `src/platform/security/authorization/official-role-permissions.ts` | Canonical CNI matrix; protected unit tests and `can()` use this map unchanged. |
| Active role matrix | `RolePermission` rows per `(organizationId, role, permission)` | What the organization actually enforces at runtime. |
| User exceptions | `UserPermissionOverride` | Per-user ALLOW/DENY on top of the active role matrix. |

When an organization has **no** `RolePermission` rows, runtime evaluation **falls back** to the official template (safe default). After migration/seed, default org `org_cni_default` is populated to match the template exactly (`pnpm rbac:verify-role-permissions` compares DB vs code).

Changing a role matrix runs in a transaction, increments `Organization.roleAccessVersion`, and bumps `OrganizationMembership.accessVersion` for all members so sessions refresh via `/api/auth/refresh-session`. `OWNER` and `ADMIN` always retain `users.*` and `roles.manage` (API rejects attempts to remove them).

Effective permission for a user:

1. Resolve the membership role capability set from `RolePermission` (or official template if empty).
2. Apply overrides (`DENY` wins over `ALLOW` over role default), via `canWithOverrides` with a role-specific checker.
3. Map fine-grained permissions to module/menu visibility using `src/platform/security/modules.ts` and `src/platform/security/module-effective.ts`.

Planilla stays **operationally sensitive**: broad grants should use audited UI (role matrix or user ALLOW overrides), not ad-hoc code edits to `OFFICIAL_ROLE_PERMISSIONS`.

Navigation, route middleware (JWT module list), and the Users → Permisos UI all use this effective evaluation. Changing overrides increments `OrganizationMembership.accessVersion`; the client refreshes the session token so menu and routes update without re-login.

## Enforcement chain

Tenant-aware operations use this chain:

1. `withAuth()` verifies the current authentication token.
2. `requireOrganizationContext()` reloads an active user and validates an active membership and organization.
3. `requirePermission(context, capability)` evaluates the membership role through `src/platform/security/authorization/permissions.ts`.
4. The application service performs tenant-scoped reads and mutations using the server-resolved `organizationId`.
5. Security-relevant mutations append an immutable `SystemAuditEvent` in the business transaction when supported.

Routes may reject early, but application services remain the authoritative capability boundary. Phase 6A applies this centralized boundary to reporting, equipment disposal, and audit-log queries. Legacy modules listed in `security-architecture.md` still require conversion.

## Tenant selection

`requireOrganizationContext()` reads the `organizationId` cookie only. It validates that value against the authenticated user's active memberships and never treats it as authority.

- One active membership and no selection: that membership is selected.
- Multiple active memberships and no selection: `ORGANIZATION_SELECTION_REQUIRED` (`409`).
- Selected organization without an active membership: `TENANT_ACCESS_DENIED` (`403`).
- No active membership: `ORGANIZATION_MEMBERSHIP_REQUIRED` (`403`).
- Inactive user: authentication is rejected.

Denied tenant-context decisions append a redacted, platform-scoped security event. The selected organization identifier is not copied into event attributes.

## IDOR rules

- Resolve ownership from the server context, never request data.
- Include resource ID and `organizationId` in the same read and mutation predicate.
- Scope child records by organization, parent, and child IDs.
- Return the tenant-scoped not-found response; do not perform an unscoped fallback lookup.
- Validate referenced users, suppliers, employees, and documents against the active organization.
- Require a capability in addition to membership and ownership.

## References

- `src/platform/security/authorization/permissions.ts`
- `src/modules/organizations/application/context.ts`
- `src/platform/security/audit/security-events.ts`
- `docs/security/authorization-matrix.md`
- `docs/security/security-architecture.md`
