# IDOR Protection

Tenant-owned routes must resolve `requireOrganizationContext()` after authentication and include its `organizationId` in every aggregate read, mutation, uniqueness check, and delete. Request body and query-string organization IDs are not ownership authority.

Child resources are accessed through a tenant-scoped parent predicate. Cross-tenant IDs therefore return inaccessible or not found instead of revealing whether the resource exists. Upload keys include the organization prefix, and `DocumentSequence` allocates numbers atomically by organization, document type, and year.

Required review checks:

- No tenant aggregate uses an ID-only `findUnique`, update, or delete.
- Parent references are validated in the current organization before child creation.
- Lists and counters include organization filters.
- Audit records receive the server-resolved organization.
- Tests compare the same guessed resource ID under two organization contexts.

PostgreSQL row-level security is not enabled, so application predicates and database ownership constraints remain the enforcement boundary.
