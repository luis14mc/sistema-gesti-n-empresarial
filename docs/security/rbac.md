# Organization RBAC and tenant isolation

SGE authorization is based on an authenticated identity, an active organization membership, a server-selected organization, and an explicit capability. Navigation visibility and legacy JWT roles are not authorization boundaries.

## Identity layers

- `User` is the platform identity and credential owner.
- `User.platformRole` is optional and limited to `PLATFORM_ADMIN` or `SUPPORT_ADMIN`.
- `OrganizationMembership` grants tenant access and carries one organization role.
- `User.role` is a legacy compatibility field. It must not grant organization capabilities or platform authority in new code.

No legacy `ADMIN` is migrated automatically to `PLATFORM_ADMIN`. Platform roles do not bypass organization membership or tenant scope.

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
