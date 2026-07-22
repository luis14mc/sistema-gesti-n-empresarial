# Tenant Isolation

## Current guarantee

Tenant isolation is implemented for the equipment-disposal module through application-level organization scoping. It is **not a repository-wide guarantee**. Legacy modules must be reviewed independently and must not be assumed tenant-scoped merely because `Organization` exists.

## Identity and tenant context

Authentication establishes a user from a signed JWT. The organization boundary is established separately by `requireOrganizationContext`:

- The authenticated user ID comes from the verified token, not from request JSON.
- A requested tenant comes from `x-organization-id`, with the `organizationId` cookie as the secondary selector.
- The requested organization is accepted only when an active membership exists and the organization is active.
- The resulting `OrganizationContext` contains `userId`, `organizationId`, `membershipId`, and `OrganizationRole`.
- Client-supplied `organizationId` fields are not part of the disposal creation schema.

When neither selector is present, the current compatibility behavior selects the earliest-created active membership. This secure-session fallback still validates membership, so it does not accept an arbitrary tenant ID; however, it can select an organization implicitly. A future phase should persist or require an explicit active organization and then remove this fallback.

## Disposal isolation controls

The equipment-disposal module applies the resolved organization in the following places:

- List and detail queries filter by `organizationId`.
- Equipment eligibility is checked with both equipment ID and organization ID.
- Active-disposal checks are organization-scoped.
- Folio sequences are unique and incremented per organization, document type, and year.
- Disposal, evidence metadata, history, audit records, policy reads, and replacement projections carry the organization ID.
- Evidence lookup and deletion scope organization, disposal, and document IDs together.
- PDF download requires an approved disposal in the current organization.
- Storage keys include `organizations/{organizationId}/equipment-disposals/{disposalId}`.
- Organization membership roles drive disposal permissions.

These controls make an identifier from another organization resolve as inaccessible or not found in disposal routes. The tests in `__tests__/equipment-disposal-tenant-isolation.test.ts` cover the scope helpers and ensure disposal input does not accept an organization ID.

## Authorization model

Organization roles are `OWNER`, `ADMIN`, `IT_MANAGER`, `IT_TECHNICIAN`, `AUDITOR`, `HR`, `PROCUREMENT`, and `USER`. Disposal permissions are mapped from these roles in `application/permissions.ts`.

`OWNER` and `ADMIN` receive all disposal permissions. `IT_MANAGER` can create, update, submit, approve, reject, cancel, read, and download. `IT_TECHNICIAN` can create, update, submit, read, and download. Read/download access is available to auditor, HR, and procurement roles; `USER` has read access only.

This organization RBAC is separate from the legacy global `User.role` checked by other routes and Server Actions.

## Known limitations

### Nullable legacy ownership

`Equipment.organizationId`, `CompraOrden.organizationId`, and `AuditRecord.organizationId` remain nullable. A backfill script can attach existing null rows to a default organization and create memberships, but nullable columns permit unowned rows to recur unless every write path supplies ownership.

The disposal flow requires organization-owned equipment, so equipment with `organizationId = null` is not eligible through the organization-scoped disposal creation query. That behavior does not correct the underlying legacy row.

### Modules without tenant keys

Several legacy entities have no organization relation. Their access patterns therefore cannot provide the same organization predicate as disposal. No cross-module or repository-wide isolation guarantee should be inferred.

### Application-level enforcement

Isolation currently depends on route, service, and repository predicates. PostgreSQL row-level security is not configured. Direct database access or a newly written unscoped query can bypass application conventions.

### Data relationships

Some foreign keys identify related records without a composite organization foreign key. The application verifies ownership before disposal operations, but the database does not universally prove that every related record shares the same organization.

### Tenant selection fallback

The first-active-membership fallback is deterministic but implicit. Users with multiple memberships can receive a context they did not explicitly select when neither header nor cookie is present.

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
2. **Schema hardening:** backfill and validate existing ownership, make applicable organization keys required, and introduce tenant-aware unique constraints.
3. **Legacy module migration:** scope one bounded module at a time, including APIs, Server Actions, exports, files, audits, and jobs.
4. **Database enforcement:** add composite ownership constraints where practical and evaluate PostgreSQL row-level security.
5. **Verification:** expand integration tests to exercise authenticated cross-tenant requests and continuously audit for unscoped Prisma access.
