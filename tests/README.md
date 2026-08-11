# Phase 10 — Test suite layout

This directory is the canonical home for cross-cutting test infrastructure
introduced in Phase 10A. It coexists with the existing top-level
`__tests__/` directory; existing tests are **not** moved.

## Layout

```
tests/
  README.md                  ← this file
  unit/                      ← pure unit tests (no Prisma, no fetch)
  integration/               ← tests that exercise the Prisma adapter
  contracts/                 ← API envelope + Zod contract tests
  security/                  ← authn, authz, IDOR, SSRF regression
  e2e/                       ← Playwright (introduced in 10D)
  accessibility/             ← axe + keyboard harness (introduced in 10E)
  performance/               ← baselines + k6 scripts (introduced in 10F)
  fixtures/                  ← shared factories (no I/O, pure builders)
  helpers/                   ← shared helpers (contracts, auth, db, cleanup)
  migrations/                ← migration-SQL validation (no live DB)
```

## Conventions

- Every test that talks to a route uses an `AuthenticatedRequest` factory
  from `tests/helpers/auth.ts`.
- Every cross-tenant test creates at least Organization A + Organization B
  with deterministic IDs (`org-a`, `org-b`).
- Every assertion against `apiSuccess` / `apiFailure` uses
  `expectSuccessEnvelope` / `expectFailureEnvelope` from
  `tests/helpers/contracts.ts`. The envelopes are the source of truth.
- Every test that produces a Prisma row must use the corresponding
  factory in `tests/factories/`. Inline fixtures are forbidden.
- Every test that needs the database and the database is not available
  must `it.skip(...)` and log the reason. We do not silently fall back
  to mocks when the suite promised integration coverage.

## Test framework rules

- Vitest globals (`describe`, `it`, `expect`) are available via
  `vitest.setup.ts`. Do not import them per file.
- `vi.hoisted` mocks are allowed at the top of the file only.
- Tests must run with `pnpm test`. They must not depend on file order.
- Coverage thresholds (`lines:60, functions:60, statements:60, branches:50`)
  are declared in `vitest.config.ts`. `pnpm test:coverage` enforces them.

## Test quality bar

- A test that only imports a module to check it exports a symbol is
  **rejected** by code review.
- A test that asserts on a private field or implementation detail is
  **rejected** by code review.
- A test that depends on real network calls or live provider secrets
  is **rejected** by code review.
- A flaky test must be quarantined within one week. See
  `docs/testing/flaky-tests.md`.
