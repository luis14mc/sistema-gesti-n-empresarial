# Phase 10A — Release quality gates

This document defines the gates the release pipeline must pass before
a SGE release can be promoted to production. Subphase 10G will wire
these into CI; the rules below are the contract for 10G and any
hot-fix release that bypasses the nightly pipeline.

## Quality gates

| Gate | Command | Blocks release? | Owner |
| --- | --- | --- | --- |
| Lint                  | `pnpm lint`                                    | yes | Platform |
| Typecheck             | `pnpm typecheck`                                | yes | Platform |
| Unit                  | `pnpm test`                                     | yes | QA |
| Security regression  | `pnpm test:regression`                          | yes | Security |
| Migration SQL         | `pnpm test` (the `tests/migrations/` subset)   | yes | Data |
| Coverage              | `pnpm test:coverage`                            | warn → block in 10B | QA |
| E2E (10D)             | `pnpm exec playwright test`                    | yes | QA |
| Accessibility (10E)   | `pnpm exec playwright test --grep @a11y`       | yes (critical violations) | UX |
| Performance (10F)     | `pnpm exec k6 run`                              | warn → block in 10G | Performance |
| Live database (10B)   | `SGE_LIVE_DB=true pnpm test:integration`       | yes | Data |
| Production build      | `pnpm build`                                    | yes | Platform |
| Release report        | `pnpm test:report`                              | yes (artifact) | QA |

## Severity scale

Defects and CI findings use:

| Severity    | Definition                                                       | Release impact       |
| ----------- | ---------------------------------------------------------------- | -------------------- |
| BLOCKER     | Prevents core flow; no workaround; data loss or security hole.  | Cannot release.      |
| CRITICAL    | Major flow broken; workaround exists but is painful or risky.   | Cannot release.      |
| MAJOR       | Edge case or specific scenario broken; workaround is reasonable. | Release with a backport; cannot release a 0.x. |
| MINOR       | Cosmetic or rare edge case; no workflow impact.                  | Can release.         |
| TRIVIAL     | Typo, comment, or test-only issue.                                | Can release.         |

A release must not proceed with unresolved BLOCKER or CRITICAL defects.

## Release sign-off

A release-quality report must include:

```
Version
Commit SHA
Migrations applied
Lint, typecheck, unit, security, migration, build results
Coverage summary (lines, functions, statements, branches)
E2E results (browser matrix, scenarios run, screenshots, accessibility summary)
Performance baselines (p50/p95/p99 deltas, throughput)
Live-database integration results
Known risks
Rollback plan
Approvals
```

Subphase 10G introduces the script that produces this report.

## Staging validation

Before production:

```
1. Deploy immutable image
2. Apply migration (pnpm prisma migrate deploy)
3. Run readiness (GET /api/health/ready)
4. Run smoke (pnpm test:regression + smoke-test.sh)
5. Run critical E2E (Playwright, restricted set)
6. Run synthetic tenant workflow
7. Verify logs / jobs / outbox
```

## Production smoke

Production smoke must remain **read-only**:

- `GET /api/health/live`
- `GET /api/health/ready`
- `GET /api/auth/login` page
- `GET /api/organizations/current` (read only)
- `GET /api/notifications/unread-count` (read only)
- Static asset verification

No create, update, delete, or institutional record modification is
permitted in a production smoke.

## Flaky-test policy

See `docs/testing/flaky-tests.md`. Summary:

- A flaky test must be quarantined within one week of the first
  failure.
- The owner is the author of the test.
- The quarantine is time-boxed to 14 days. After 14 days the test is
  either fixed or deleted.
- No silent `retries` are added to a CI step to mask a flaky test.
