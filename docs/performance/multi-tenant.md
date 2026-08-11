# Phase 11E — Multi-tenant scalability

## 1. Tenant isolation invariants

The platform enforces tenant isolation at three layers:

1. **Repository helpers** (`src/modules/**/infrastructure/tenant-scope.ts`)
   produce `where` clauses that **always** include `organizationId`.
2. **API routes** call `requireOrganizationContext(req, requestId)` to
   resolve the active tenant from the cookie / request context.
3. **Database schema** declares `organizationId` as NOT NULL on every
   business table (asserted by `tests/integration/data-quality.test.ts`).

The Phase 11E invariant to confirm: **the same resource ID across
tenants must produce isolated results**. The k6 multi-tenant
scenario (`tests/performance/scenarios/multi-tenant.js`) executes
that invariant for read traffic.

## 2. Noisy-neighbor scenario

The recommended test is:

1. Create two synthetic organizations on the same database.
2. Drive Tenant A with a 30-minute PDF burst (10 concurrent jobs).
3. In parallel, drive Tenant B with normal CRUD traffic.
4. Measure Tenant B's p95 latency.

The acceptance criterion:

- Tenant B's p95 must stay within +20% of its solo baseline.
- Tenant B's error rate must not exceed 0.5%.

The Phase 11E scaffold (`tests/performance/noisy-neighbor.test.ts`)
documents the acceptance criteria. The actual run requires the live
worker processor (Phase 12 prerequisite).

## 3. Per-tenant ceilings

The architecture supports per-tenant ceilings via:

- `Organization.modules` (Phase 7A) — features gated per tenant.
- `Organization.modules.concurrencyLimits` (planned) — explicit
  queue ceilings per tenant.

Until the field is implemented, the Phase 11E acceptance is:
**no tenant can starve another tenant's worker capacity**. The
worker queue is global; the per-tenant dispatch is fair.

## 4. Cache isolation

The platform does not yet use a distributed cache. Every cache entry
in the React Query client is keyed by the cookie-bound user, so two
tenants cannot share a cache. The Phase 11E assertion is in
`tests/performance/react-query-budget.test.ts`.

## 5. Tenant switching

`requireOrganizationContext` is called once per request that has a
tenant context. The Phase 11E recommendation is to:

- Cache the resolved context per request (already done via
  `React.cache`).
- Cap the cache lifetime at 60 s.
- Never cache revoked sessions.

## 6. Multi-tenant k6 scenario

The `tests/performance/scenarios/multi-tenant.js` script runs:

- 10 organizations × 5 users = 50 concurrent VUs.
- Each request passes an `x-organization-id` header to scope the
  query.
- The same resource ID `id=foo-1` is requested across tenants to
  detect accidental cache leaks.

The acceptance criterion is documented in
`docs/performance/capacity-model.md`.

## 7. Recommendations

- Keep the per-tenant payload schema identical so the front-end
  cache key is trivial.
- When a future distributed cache is introduced, **every** key must
  include `organizationId`.
- Never introduce a global "platform admin" cache that omits
  `organizationId`.
