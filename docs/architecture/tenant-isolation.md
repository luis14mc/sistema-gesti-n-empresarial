# Tenant Isolation

## Current guarantee

Tenant isolation is implemented through application-level organization scoping for equipment, assignments, maintenance, equipment disposal, Oficios, active purchase orders, suppliers, cost centers, institutional audits, corrective actions, and audit logs. It is **not a repository-wide guarantee**: attendance, promotional inventory, and legacy purchase models remain outside this boundary.

## Identity and tenant context

Authentication establishes a user from a signed JWT. The organization boundary is established separately by `requireOrganizationContext`:

- The authenticated user ID comes from the verified token, not from request JSON.
- A requested tenant comes from `x-organization-id`, with the `organizationId` cookie as the secondary selector.
- The requested organization is accepted only when an active membership exists and the organization is active.
- The resulting `OrganizationContext` contains `userId`, `organizationId`, `membershipId`, and `OrganizationRole`.
- Client-supplied `organizationId` is never used as ownership authority.

When a user has exactly one active membership, it can be selected implicitly. Users with multiple active memberships must provide a valid selector; otherwise context resolution returns `ORGANIZATION_SELECTION_REQUIRED`.

## Isolation controls

Tenant-aware modules apply the resolved organization in the following places:

- List and detail queries filter by `organizationId`.
- Equipment eligibility is checked with both equipment ID and organization ID.
- Active-disposal checks are organization-scoped.
- Folio sequences are unique and incremented per organization, document type, and year.
- Disposal, evidence metadata, history, audit records, policy reads, and replacement projections carry the organization ID.
- Evidence lookup and deletion scope organization, disposal, and document IDs together.
- PDF download requires an approved disposal in the current organization.
- Storage keys include `organizations/{organizationId}/...`.
- Organization membership roles drive disposal permissions.

These controls make an identifier from another organization resolve as inaccessible or not found. Focused scope tests cover organization context, equipment, disposal, Oficios, purchases, and audits. Database-backed authenticated cross-tenant integration coverage remains a follow-up.

## Authorization model

Organization roles are `OWNER`, `ADMIN`, `IT_MANAGER`, `IT_TECHNICIAN`, `AUDITOR`, `HR`, `PROCUREMENT`, and `USER`. Capabilities are mapped centrally in `src/platform/security/authorization/permissions.ts`.

`OWNER` and `ADMIN` receive all disposal permissions. `IT_MANAGER` can create, update, submit, approve, reject, cancel, read, and download. `IT_TECHNICIAN` can create, update, submit, read, and download. Read/download access is available to auditor, HR, and procurement roles; `USER` has read access only.

This organization RBAC is separate from the legacy global `User.role` checked by other routes and Server Actions.

## Known limitations

### Migration deployment

The Prisma contract requires ownership for the Phase 1 aggregate roots. Migration `20260722210000_phase1_tenant_hardening` resolves CNI by slug, backfills existing records, validates supplier RTN collisions, applies required columns, and replaces global business-key uniqueness with organization-scoped uniqueness. Until that migration is deployed, the generated application contract and database schema are intentionally in an expansion/enforcement transition.

### Modules without tenant keys

Several legacy entities still have no organization relation. `User.departmentId` and `User.positionId` are also global and cannot represent different assignments in multiple organizations. No repository-wide isolation guarantee should be inferred.

### Application-level enforcement

Isolation currently depends on route, service, and repository predicates. PostgreSQL row-level security is not configured. Direct database access or a newly written unscoped query can bypass application conventions.

### Data relationships

Some foreign keys identify related records without a composite organization foreign key. The application verifies ownership before disposal operations, but the database does not universally prove that every related record shares the same organization.

## Rules for new organization-aware work

- Resolve organization context on the server after authentication.
- Never trust an organization ID from a JSON body as ownership authority.
- Include `organizationId` in every read, update, delete, uniqueness check, and aggregate lookup.
- Check the organization of parent records before creating children.
- Use organization-specific roles rather than global roles for tenant-owned operations.
- Prefix stored objects with the organization and aggregate IDs.
- Record organization, user, entity, action, and request ID in audit/history records.
- Test same-ID and guessed-ID access across at least two organizations.
- Avoid marking a module tenant-safe until all of its entry points and background processes meet these rules.

## Staged next phases

1. **Context hardening:** establish an explicit active-organization session contract and remove implicit selection after migration.
2. **Legacy module migration:** scope one bounded module at a time, including APIs, Server Actions, exports, files, audits, and jobs.
3. **Database enforcement:** add composite ownership constraints where practical and evaluate PostgreSQL row-level security.
4. **Verification:** expand integration tests to exercise authenticated cross-tenant requests and continuously audit for unscoped Prisma access.
