# Phase 10A — Test pyramid

The test pyramid encodes the proportion of tests we expect at every
level. It is enforced by review, not by code. The intent is to keep
the bulk of coverage at the cheapest levels and reserve the expensive
levels for the few flows where they actually add confidence.

## Levels

```
                   /\
                  /  \      E2E (Playwright)
                 /    \     ~ 5–15 scenarios
                /------\    Critical journeys only
               /        \
              /  Security \  Authn, authz, IDOR, CSRF, file security
             /  Contract  \  ~ 30–60 tests
            /--------------\
           /  Domain & App  \  Pure logic, factories, services with mocked Prisma
          /   (unit, shape)  \  ~ 200–500 tests
         /--------------------\
```

## When to use which level

- **Unit / shape**: status transitions, calculations, permission
  matrices, idempotency key generation, retry classification, IDOR
  shape assertions, MIME allowlists. These are the cheapest tests and
  catch the most regressions. Prefer this level for new logic.
- **Domain + application service**: command handlers, queries, and
  service-layer orchestration. Use mocked Prisma for these. Cross-tenant
  invariants are validated by passing two contexts and asserting that
  the second context receives a controlled denial.
- **Security regression**: `withAuth`, `requireOrganizationContext`,
  `requirePermission`, IDOR filter, SSRF guard, secret redaction. These
  are codified in `tests/security/`.
- **Contract**: API envelope shape, status code mapping, error code
  catalogue, request-id propagation. Codified in `tests/contracts/`.
- **E2E** (10D): one or two critical journeys per role. Never
  re-implement a unit-level assertion in E2E.
- **Accessibility** (10E): axe rules per page. Critical violations
  block the release.
- **Performance** (10F): k6 scenarios. Baselines; deviations warn
  first, then block.

## Anti-patterns

- **Testing every detail through E2E.** E2E is slow and flaky. Use it
  only for the journeys that have to work end-to-end.
- **Re-implementing the same assertion at multiple levels.** If a
  permission is enforced in `requirePermission`, do not also assert it
  in every E2E flow.
- **Coupling tests to implementation details.** A test that reads
  private fields, internal timers, or the order of method calls will
  break during a refactor that does not change behaviour. Reject such
  tests at review.
- **Mocks that re-implement the production code.** A mock that
  re-implements the unit being tested is worse than no test at all —
  it is a tautology. Mocks must answer only the questions the test
  cares about.

## Proportion targets

Phase 10A is the foundation; concrete counts are not yet enforced. The
following proportions are the target for the **release** pipeline:

| Level                | Target share of total tests |
| -------------------- | ---------------------------- |
| Unit + shape         | ≥ 70 %                       |
| Domain + application | ≥ 20 %                       |
| Contract + security  | ≤ 5 %                        |
| E2E                  | ≤ 5 %                        |
| Accessibility        | ≤ 1 %                        |
| Performance          | scripts only, not counts      |
