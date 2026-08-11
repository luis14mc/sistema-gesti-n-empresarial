# Domain permissions

The source of truth is `src/platform/security/authorization/permissions.ts`. Operational authorization is based on active organization membership, not editable request data, legacy JWT role, platform role, or hidden frontend actions. `OrganizationContext` and `CommandContext` carry the tagged organization scope resolved by the server.

Application services must enforce capabilities before changing domain state. Routes may perform an early UX/security check, but that does not replace service-level enforcement.

`can(scopedRole, permission)` is suitable for deterministic policy decisions and UI hints. `requirePermission(context, permission)` is the server enforcement function and fails with `PermissionDeniedError`.

Capability names follow `aggregate.action`, for example:

- `purchase-orders.generate`
- `purchase-orders.cancel`
- `equipment.assign`
- `equipment.maintain`
- `equipment-disposal.approve`
- `offices.complete`

Cross-tenant resource access must fail through a tenant-scoped lookup and must never trust an organization ID from the request body.

Platform permissions are separately tagged. `PLATFORM_ADMIN` and `SUPPORT_ADMIN` do not receive organization capabilities and cannot silently bypass tenant scope.
