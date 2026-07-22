# SaaS Architecture

## Status and scope

The repository is a **modular monolith** implemented as one Next.js application and one PostgreSQL database. UI routes, API route handlers, application services, domain logic, Prisma persistence, PDF generation, and storage adapters are deployed from the same codebase and process boundary.

The SaaS transition is partial. `Organization` and `OrganizationMembership` provide a tenant model, and the equipment-disposal module uses it end to end. This does **not** mean that every legacy module or table is tenant-scoped. Modules without an enforced organization boundary must not be presented as multi-tenant safe.

## Runtime building blocks

- Next.js App Router provides pages, Server Actions, and route handlers.
- React provides the user interface and server-rendered document markup.
- Prisma accesses PostgreSQL.
- JWT authentication is accepted from the HttpOnly `token` cookie; API middleware also accepts a Bearer token.
- Zod validates disposal request payloads.
- A storage abstraction selects local filesystem storage by default or S3 when `STORAGE_DRIVER=s3`.
- Puppeteer-based HTML-to-PDF rendering is reused by document-producing modules.

This is not a microservice architecture. Module boundaries are source-code boundaries, and modules may share the Prisma client, storage infrastructure, authentication helpers, and platform response/logging utilities.

## Layers

The newer equipment-disposal implementation demonstrates the intended layered structure:

| Layer | Responsibility | Current examples |
| --- | --- | --- |
| Presentation | HTTP adaptation, request validation, UI, response/error mapping | `src/app/api/equipment-disposal`, `presentation/http.ts`, `presentation/schemas`, `presentation/components` |
| Application | Use-case orchestration, permissions, transactions, workflow side effects | `application/service.ts`, `application/permissions.ts` |
| Domain | Evaluation rules, status transitions, domain errors and types | `domain/evaluator.ts`, `domain/rules.ts` |
| Infrastructure | Prisma queries, tenant scopes, document storage, PDF generation | `infrastructure/repository.ts`, `tenant-scope.ts`, `documents.ts`, `pdf.tsx` |
| Shared platform | Authentication, Prisma, storage, API envelopes, logging and audit support | `src/lib`, `src/platform` |

Legacy areas do not uniformly follow these layers. The layered module is an incremental architecture, not a claim that the entire repository has already been reorganized.

## Organization model

`Organization` is the tenant record. `OrganizationMembership` joins a user to an organization and records an organization-specific role and membership status. A user can have memberships in multiple organizations; the `(organizationId, userId)` pair is unique.

The global `User.role` remains in use by legacy authentication and authorization paths. Organization-aware modules instead authorize with `OrganizationMembership.role`. These two role systems coexist and are not interchangeable.

For organization-aware disposal requests, the server:

1. Authenticates the JWT through `withAuth`.
2. Resolves an active membership through `requireOrganizationContext`.
3. Rejects a requested organization for which the user has no active membership.
4. Passes the resolved `organizationId`, user ID, membership ID, and organization role to the application layer.
5. Applies organization predicates to disposal data access and organization-specific RBAC to actions.

## Current session and organization fallback

Authentication uses a signed JWT in an HttpOnly cookie named `token`. The login cookie is `SameSite=Lax`, has a one-hour maximum age, and sets `Secure` only when `NODE_ENV=production`. `JWT_SECRET` is required and validated by the authentication implementation.

The active organization is requested through `x-organization-id` or the `organizationId` cookie. If neither is present, `requireOrganizationContext` currently falls back to the user's earliest-created active membership in an active organization. This supports existing sessions that do not yet carry an explicit organization selection, but it is an implicit compatibility fallback, not a durable tenant-selection contract. If the user has no eligible membership, the request fails.

## Persistence and migration limitation

The disposal aggregate and its policy, evidence, history, numbering, and replacement projection require `organizationId`. Their indexes and uniqueness rules include the organization where appropriate.

The legacy migration remains incomplete:

- `Equipment.organizationId` is nullable.
- `CompraOrden.organizationId` is nullable.
- `AuditRecord.organizationId` is nullable.
- Several legacy models have no `organizationId` field at all.
- The backfill script assigns null equipment, purchase orders, and audit records to a default organization, but the schema still permits future null values.

Consequently, database shape alone does not enforce universal tenant ownership. A module is tenant-safe only where its request context, authorization, queries, writes, relationships, and storage keys are all scoped and tested.

## Deployment characteristics

The application and its modules scale as one deployment unit. PostgreSQL and object storage are shared infrastructure. Tenant separation is implemented with application-level predicates and organization-owned records; the repository does not implement a database-per-tenant model or PostgreSQL row-level security.

Local storage writes below `public/uploads` and is intended as the default development driver. The S3 adapter stores private objects by default and is the production-oriented driver. Disposal routes stream authorized files through the application rather than relying on a public storage URL.

## Staged next phases

These are architectural stages, not claims of completed work:

1. **Harden tenant selection:** make organization selection explicit in the session or request contract and remove the first-membership fallback after clients are migrated.
2. **Complete ownership migration:** inventory legacy tables, backfill ownership, reject unresolved rows, make applicable `organizationId` columns non-null, and add tenant-aware uniqueness constraints.
3. **Migrate module boundaries:** introduce organization context, organization-role authorization, scoped repositories, audit context, storage prefixes, and isolation tests module by module.
4. **Add defense in depth:** evaluate centralized Prisma safeguards and PostgreSQL row-level security after all ownership relationships are reliable.
5. **Operationalize SaaS controls:** add tenant-aware observability, backup/restore procedures, retention controls, quotas, and cross-tenant security testing.

Until stages 2 and 3 are complete, documentation and product claims must identify exactly which modules are organization-aware.
