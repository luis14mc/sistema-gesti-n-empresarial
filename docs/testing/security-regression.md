# Phase 10A — Security regression baseline

This document enumerates the security regressions that **must** be
covered by tests. Each item has a stable test ID so we can trace
failures to the regression they protect.

## SR-01 — `withAuth` middleware

| Test | Description | File |
| --- | --- | --- |
| SR-01-a | returns `AUTHENTICATION_REQUIRED` when no token is present | `tests/contracts/auth-middleware.test.ts` |
| SR-01-b | returns `AUTHENTICATION_REQUIRED` when the token signature is invalid | `tests/contracts/auth-middleware.test.ts` |
| SR-01-c | returns `FORBIDDEN` when the user role is not in the allow-list | `tests/contracts/auth-middleware.test.ts` |
| SR-01-d | propagates the user identity to the handler when the token is valid | `tests/contracts/auth-middleware.test.ts` |
| SR-01-e | attaches the `x-request-id` header on every response | `tests/contracts/auth-middleware.test.ts` |
| SR-01-f | accepts the token from the `token` cookie when the authorization header is absent | `tests/contracts/auth-middleware.test.ts` |
| SR-01-g | returns `AUTHENTICATION_REQUIRED` when the handler throws (current behaviour) | `tests/contracts/auth-middleware.test.ts` |

## SR-02 — `requireOrganizationContext`

| Test | Description | File |
| --- | --- | --- |
| SR-02-a | automatically selects the only active membership | `__tests__/organization-context.test.ts` |
| SR-02-b | requires explicit selection when multiple memberships are active | `__tests__/organization-context.test.ts` |
| SR-02-c | refuses cross-tenant cookie selection | `__tests__/organization-context.test.ts` |
| SR-02-d | refuses a non-active user | `__tests__/organization-context.test.ts` |

## SR-03 — `requirePlatformContext`

| Test | Description | File |
| --- | --- | --- |
| SR-03-a | accepts a user with the `PLATFORM_ADMIN` role | `__tests__/organization-platform-context.test.ts` |
| SR-03-b | refuses a user without any platform role | `__tests__/organization-platform-context.test.ts` |
| SR-03-c | refuses a user with a platform role that is not in the allow-list | `__tests__/organization-platform-context.test.ts` |

## SR-04 — IDOR filter

| Test | Description | File |
| --- | --- | --- |
| SR-04-a | ADMIN sees everything (no filter added) | `tests/security/idor-regression.test.ts` |
| SR-04-b | USER with `self-record` is filtered by `userId` | `tests/security/idor-regression.test.ts` |
| SR-04-c | USER with `owner` is filtered by `createdById` | `tests/security/idor-regression.test.ts` |
| SR-04-d | USER with `none` is blocked by the sentinel id `__never__` | `tests/security/idor-regression.test.ts` |
| SR-04-e | USER with `assigned` adds an `OR` of ownership fields | `tests/security/idor-regression.test.ts` |
| SR-04-f | `checkItemAccess` returns false for a null item | `tests/security/idor-regression.test.ts` |
| SR-04-g | `checkItemAccess` returns true for ADMIN regardless of `userAccess` | `tests/security/idor-regression.test.ts` |
| SR-04-h | `checkItemAccess` honours the `customCheck` escape hatch | `tests/security/idor-regression.test.ts` |

## SR-05 — Authorization matrix

| Test | Description | File |
| --- | --- | --- |
| SR-05-a | OWNER and ADMIN have every integration permission | `tests/security/authorization-matrix.test.ts` |
| SR-05-b | IT_MANAGER has the read/test/view-history subset | `tests/security/authorization-matrix.test.ts` |
| SR-05-c | AUDITOR can read and view history but cannot mutate | `tests/security/authorization-matrix.test.ts` |
| SR-05-d | USER has no integration permission | `tests/security/authorization-matrix.test.ts` |
| SR-05-e | PROCUREMENT cannot manage webhooks | `tests/security/authorization-matrix.test.ts` |
| SR-05-f | platform roles do not silently gain organization integration rights | `tests/security/authorization-matrix.test.ts` |
| SR-05-g | every organization role can read notifications | `tests/security/authorization-matrix.test.ts` |
| SR-05-h | IT_MANAGER can manage their own preferences but not organization-wide settings | `tests/security/authorization-matrix.test.ts` |
| SR-05-i | USER can read but cannot manage any notification setting | `tests/security/authorization-matrix.test.ts` |
| SR-05-j | `requirePermission` throws `PermissionDeniedError` when a permission is missing | `tests/security/authorization-matrix.test.ts` |
| SR-05-k | `requirePermission` does not allow a platform role to bypass an organization check | `tests/security/authorization-matrix.test.ts` |
| SR-05-l | SUPPORT_ADMIN has only `platform.health.read` | `tests/security/authorization-matrix.test.ts` |
| SR-05-m | PLATFORM_ADMIN has every platform permission | `tests/security/authorization-matrix.test.ts` |

## SR-06 — File security

| Test | Description | File |
| --- | --- | --- |
| SR-06-a | accepts a real PDF header | `tests/security/file-security.test.ts` |
| SR-06-b | rejects an executable masquerading as a PDF | `tests/security/file-security.test.ts` |
| SR-06-c | rejects HTML embedded as a PDF | `tests/security/file-security.test.ts` |
| SR-06-d | rejects SVG with embedded script | `tests/security/file-security.test.ts` |
| SR-06-e | rejects an oversized payload past the 25 MB cap | `tests/security/file-security.test.ts` |
| SR-06-f | rejects a checksum mismatch when stored and computed hashes differ | `tests/security/file-security.test.ts` |
| SR-06-g | rejects unknown MIME types | `tests/security/file-security.test.ts` |
| SR-06-h | rejects mismatched MIME and extension pairs | `tests/security/file-security.test.ts` |
| SR-06-i | rejects double extensions that may bypass extension checks | `tests/security/file-security.test.ts` |
| SR-06-j | equipment document type allowlist does not include executable extensions | `tests/security/file-security.test.ts` |
| SR-06-k | rejects storage keys that omit the organization prefix | `tests/security/file-security.test.ts` |
| SR-06-l | accepts well-formed tenant storage keys | `tests/security/file-security.test.ts` |

## SR-07 — API envelope (contract)

| Test | Description | File |
| --- | --- | --- |
| SR-07-a | success envelope matches the documented shape and sets `x-request-id` | `tests/contracts/api-envelope.test.ts` |
| SR-07-b | success envelope does not include an `error` field | `tests/contracts/api-envelope.test.ts` |
| SR-07-c | failure envelope matches the documented shape with code, message, optional details and stage | `tests/contracts/api-envelope.test.ts` |
| SR-07-d | failure envelope omits `details` and `stage` when not provided | `tests/contracts/api-envelope.test.ts` |
| SR-07-e | failure envelope attaches `x-request-id` | `tests/contracts/api-envelope.test.ts` |
| SR-07-f | failure envelope never echoes a secret keyword in the response body | `tests/contracts/api-envelope.test.ts` |
| SR-07-g | `ConcurrentModificationError` renders with `CONCURRENT_MODIFICATION` and 409 | `tests/contracts/api-envelope.test.ts` |

## SR-08 — Cross-tenant invariants

| Test | Description | File |
| --- | --- | --- |
| SR-08-a | the same user may belong to two organizations with the same role | `tests/security/idor-regression.test.ts` |
| SR-08-b | membership status can differ between two organizations for the same user | `tests/security/idor-regression.test.ts` |

## SR-09 — Migration and data quality

| Test | Description | File |
| --- | --- | --- |
| SR-09-a | every business table has an `organizationId` column | `tests/integration/data-quality.test.ts` |
| SR-09-b | `Organization.slug` is unique | `tests/integration/data-quality.test.ts` |
| SR-09-c | `OrganizationMembership` has a unique `(organizationId, userId)` pair | `tests/integration/data-quality.test.ts` |
| SR-09-d | `Notification` has a unique `(organizationId, idempotencyKey)` pair | `tests/integration/data-quality.test.ts` |
| SR-09-e | `OrganizationIntegration` has a unique `(organizationId, provider, name)` tuple | `tests/integration/data-quality.test.ts` |
| SR-09-f | `DomainEventOutbox` has a unique `(organizationId, aggregateType, aggregateId, aggregateVersion, eventType)` tuple | `tests/integration/data-quality.test.ts` |
| SR-09-g | every business table enforces `NOT NULL` on `organizationId` | `tests/integration/data-quality.test.ts` |
| SR-09-h | the lifecycle status enum declares `PROVISIONING`, `ARCHIVED`, `PENDING_DELETION` | `tests/integration/data-quality.test.ts` |
| SR-09-i | the notification channel/status enums declare the required values | `tests/integration/data-quality.test.ts` |
| SR-09-j | the integration status/capability enums declare the required values | `tests/integration/data-quality.test.ts` |

## SR-10 — Migration SQL validation

| Test | Description | File |
| --- | --- | --- |
| SR-10-a | every migration directory uses a 14-digit prefix | `tests/migrations/migration-validation.test.ts` |
| SR-10-b | every migration directory uses `migration.sql` | `tests/migrations/migration-validation.test.ts` |
| SR-10-c | Phase 1 created the per-organization composite unique indexes | `tests/migrations/migration-validation.test.ts` |
| SR-10-d | Phase 7A added the lifecycle status values and the onboarding status enum | `tests/migrations/migration-validation.test.ts` |
| SR-10-e | Phase 8A created the notifications and notification_deliveries tables | `tests/migrations/migration-validation.test.ts` |
| SR-10-f | Phase 9A created the integration tables with the per-organization unique index | `tests/migrations/migration-validation.test.ts` |
| SR-10-g | every post-Phase-1 migration declares a primary key for every `CREATE TABLE` | `tests/migrations/migration-validation.test.ts` |
| SR-10-h | no post-Phase-1 migration issues a `DROP TABLE` | `tests/migrations/migration-validation.test.ts` |
