# Security testing

## Phase 6A automated evidence

| Control | Test evidence |
| --- | --- |
| Every role/capability has an explicit decision | `__tests__/authorization-foundation.test.ts` |
| Platform roles cannot inherit organization authority | `__tests__/authorization-foundation.test.ts` |
| Raw legacy role strings fail closed | `__tests__/authorization-foundation.test.ts` |
| Unauthorized audit read fails before data access | `__tests__/authorization-foundation.test.ts` |
| Tenant selection validates membership | `__tests__/organization-context.test.ts` |
| Cross-tenant selector denial creates a security event | `__tests__/organization-context.test.ts` |
| Reporting checks capability before handler/repository | `__tests__/reporting-foundation.test.ts` |
| Tenant-shaped report filters are rejected | `__tests__/reporting-foundation.test.ts` |
| Security-event attributes redact credential-shaped keys | `__tests__/domain-event-foundations.test.ts` |

## Migration verification

Database verification must prove:

- The Phase 6A migration applies after all existing migrations.
- `SystemAuditEvent` insert succeeds.
- Update, delete, and truncate are rejected by PostgreSQL triggers.
- A user receives no platform role by migration default.

## Deferred mandatory scenarios

The following Phase 6 definition-of-done tests are intentionally not claimed by 6A: session revocation, deactivated-token rejection on every route, CSRF/Origin, distributed rate limiting, password reset, invitations, MFA, upload signatures/quarantine, secure document delivery, sensitive exports, support access, and client-bundle secret inspection. They must be implemented in their assigned subphases before Phase 6 completion.
