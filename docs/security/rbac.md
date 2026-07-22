# Organization RBAC and tenant isolation

This document describes the authorization behavior implemented in the repository. It is not a description of a future, system-wide tenant model.

## Authorization layers

The application currently has two related but distinct role systems:

1. The legacy `Role` (`ADMIN`, `IT`, `RRHH`, `USER`) is carried in the JWT and enforced by `withAuth()`, `canAccess()`, route access checks, and selected workflow rules.
2. `OrganizationRole` is stored on an active `OrganizationMembership` and currently drives capability checks for the tenant-aware equipment-disposal module.

An organization role does not replace the legacy JWT role outside tenant-aware modules. Hiding a navigation item or passing a page middleware check is not authorization; every server operation must authenticate, resolve its organization membership, check the required capability, and scope its database operation.

## Organization capability matrix

The source of truth for the implemented equipment-disposal capabilities is `src/modules/equipment-disposal/application/permissions.ts`.

| Organization role | Read | Create | Update | Submit | Approve | Reject | Cancel | Configure | Download |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `OWNER` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `ADMIN` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `IT_MANAGER` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No | Yes |
| `IT_TECHNICIAN` | Yes | Yes | Yes | Yes | No | No | No | No | Yes |
| `PROCUREMENT` | Yes | No | No | No | No | No | No | No | Yes |
| `HR` | Yes | No | No | No | No | No | No | No | Yes |
| `AUDITOR` | Yes | No | No | No | No | No | No | No | Yes |
| `USER` | Yes | No | No | No | No | No | No | No | No |

`configure` exists in the capability matrix, but no equipment-disposal configuration route currently invokes it. The table records capabilities, not proof that every capability has a public endpoint.

## Server enforcement

Tenant-aware equipment-disposal requests use the following enforcement chain:

1. `withAuth()` accepts a bearer token or the HttpOnly `token` cookie, verifies the JWT, and attaches its user identity to the request. Missing or invalid authentication returns `401`.
2. `requireOrganizationContext()` resolves an active membership belonging to that authenticated user and requires the organization itself to be active.
3. `requirePermission()` checks the membership's `OrganizationRole` for the requested operation. Failure returns `403` through `runDisposalRoute()`.
4. Services and repositories include `organizationId` in reads, writes, state transitions, child-document lookups, policy lookups, sequence allocation, and history records.

Capability checks belong on the server even when the UI disables the same action. New endpoints must not rely only on the legacy route-role list, client state, or a resource ID.

## Tenant context

`requireOrganizationContext()` reads the requested tenant from `x-organization-id`, then from the `organizationId` cookie. It never trusts either value as authorization: it queries `OrganizationMembership` using both the authenticated `userId` and requested `organizationId`, with active membership and organization statuses.

If no tenant is supplied, the earliest active membership by `createdAt` is selected. If the user has no active membership, the request fails with `ORGANIZATION_CONTEXT_REQUIRED` (`400`). If a tenant was supplied but does not belong to the user, it fails with `TENANT_ACCESS_DENIED` (`403`). Callers should therefore send an explicit organization when users can belong to more than one tenant.

The context returned to application code contains `userId`, `organizationId`, `membershipId`, and the organization role. Request payloads must not supply or override ownership. For example, equipment-disposal input schemas omit `organizationId`; the server injects it from this context.

## IDOR rules

All object references are untrusted, including parent IDs, child IDs, storage keys, and IDs supplied in request bodies.

- Query tenant-owned records with the resource ID and `organizationId` in the same database predicate, for example `findFirst({ where: { id, organizationId } })`.
- Scope child records by tenant, parent, and child together. Disposal documents use `{ organizationId, disposalId, id: documentId }`.
- Scope mutations and workflow transitions in the mutation predicate. Do not authorize with one query and then update by bare ID.
- Derive `organizationId` from `requireOrganizationContext()` only. Ignore or reject tenant ownership fields from client input.
- Keep organization scope in sequence, policy, audit/history, replacement projection, and storage paths, not only the top-level record.
- Return the module's not-found response when a resource does not exist in the active tenant. Do not fall back to an unscoped lookup to distinguish another tenant's record.
- Apply capability checks in addition to tenant scope. Tenant membership answers “which organization”; capability answers “which operation.”

The legacy helper in `src/lib/idor.ts` provides owner/assignee/self-record filtering for legacy `Role` authorization. It does not add organization isolation automatically and is not a substitute for an `organizationId` predicate.

## Current limitation

Organization ownership is not yet mandatory across the legacy domain. In the Prisma schema, `equipment.organizationId`, `purchase_orders.organizationId`, and `audit_records.organizationId` remain nullable. The SaaS foundation migration explicitly leaves them nullable while legacy repositories are converted to enforce tenant scope.

Equipment-disposal tables, documents, history, policies, sequences, and replacement projections use required organization ownership. Equipment API routes are tenant-scoped, but nullable legacy rows and repositories not yet converted mean the application must not be represented as fully multi-tenant until the contract stage in the migration plan is complete.

## Implementation references

- `src/lib/middleware.ts`
- `src/lib/permissions.ts`
- `src/lib/idor.ts`
- `src/modules/organizations/application/context.ts`
- `src/modules/equipment-disposal/application/permissions.ts`
- `src/modules/equipment-disposal/infrastructure/tenant-scope.ts`
- `prisma/schema.prisma`
