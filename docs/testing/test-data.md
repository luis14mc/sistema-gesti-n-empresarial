# Phase 10A — Test data management

Every test in the new `tests/` tree must build its fixtures via the
shared factories. Inline fixtures are forbidden in 10B onwards.

## Factories

The factories under `tests/factories/` are pure data builders; they do
not touch Prisma and do not require a live database.

| Factory file                      | Helpers                                               |
| --------------------------------- | ----------------------------------------------------- |
| `tests/factories/organizations.ts` | `createTestOrganization`, `createTestMembership`, `createTestOrganizationPair` |
| `tests/factories/users.ts`         | `createTestUser`, `createTestUserPair`                |
| `tests/factories/equipment.ts`     | `createTestEquipment`                                  |
| `tests/factories/oficios.ts`       | `createTestOffice`                                     |
| `tests/factories/disposal.ts`      | `createTestDisposal`                                    |
| `tests/factories/purchases.ts`     | `createTestPurchaseOrderDraft`                         |
| `tests/factories/notifications.ts` | `seedNotification`                                      |
| `tests/factories/integrations.ts`  | `seedOrganizationIntegration`                           |

`tests/fixtures/index.ts` re-exports every factory. Importing from the
barrel is the convention:

```ts
import { createTestOrganizationPair, createTestUserPair } from '../../fixtures';
```

## Cross-tenant fixtures

A test that asserts tenant isolation must build at least:

- `organizationA` and `organizationB` with deterministic IDs (`org-a`,
  `org-b`).
- `userA` and `userB` with deterministic IDs (`user-a`, `user-b`).
- A membership in each organization for each user.

`createTestOrganizationPair()` and `createTestUserPair()` produce these
in a single call. The membership must be built explicitly because the
relationship carries the tenant scope.

## Reset hooks

Tests that need to mutate the database must use `cleanupTestTenant` from
`tests/helpers/database.ts`. The helper:

1. Deletes every row that has an `organizationId` column.
2. Deletes the outbox and audit events for the tenant.
3. Returns the total number of rows removed (for assertions in
   integration tests).

The helper is a no-op when `SGE_LIVE_DB` is unset. It must not be
called against staging or production.

## Overrides

Every factory accepts a `Partial<TestX>` argument. Override only the
fields that matter to the test; never override the `id` to a value
that already exists in another fixture (use the deterministic
`org-a` / `org-b` / `user-a` / `user-b` set instead).

## Sensitive data

Factories must never include real user data. Passwords are placeholders
(`'TestPassword!123'`), emails use the `example.test` reserved
domain, and phone numbers are random E.164-format placeholders.

## Test isolation in CI

CI runs `pnpm test` in a single process. To prevent state leakage
between test files:

- `vi.mock` calls must be inside `vi.hoisted` blocks.
- `vi.resetAllMocks()` is called in `beforeEach` blocks where mocks
  carry state.
- `vi.useFakeTimers()` must be paired with `vi.useRealTimers()`.
- Tests must not write to the file system outside `tmpdir()`.

The cleanup helper and the factories are sufficient for unit-level
tests. Live-database integration tests must additionally wrap the
test in a transaction (`prisma.$transaction`) and roll back on
completion; see 10B.
