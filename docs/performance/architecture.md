# Phase 11 — Performance architecture

This document describes the **current** performance architecture.
Every claim is backed by the source files that implement the
behaviour.

## 1. Process model

```
                          ┌──────────────────────────────┐
                          │          Next.js             │
                          │  (web/server + API routes)   │
                          │   one process per replica    │
                          └──────────┬───────────────────┘
                                     │
                       ┌─────────────┴──────────────┐
                       │                            │
              ┌────────▼─────────┐         ┌────────▼─────────┐
              │   PostgreSQL     │         │      S3          │
              │   (RDS, single   │         │   (private)      │
              │    primary)      │         │                  │
              └──────────────────┘         └──────────────────┘
                       ▲
                       │
              ┌────────┴─────────┐
              │     Worker       │
              │  (separate       │
              │   process)       │
              └──────────────────┘
```

Each web replica and each worker replica is **stateless**. State
lives in:

- **PostgreSQL** — business data, audit, outbox, notifications.
- **S3** — documents, attachments, exports.
- **The cookie** — user session (JWT).

There is no local in-memory session store, no local file upload,
and no local job ownership.

## 2. Pool and lock invariants

- Web replicas do not share connections. Each replica has its own
  Prisma pool of `DATABASE_POOL_MAX` connections.
- Worker replicas do the same.
- DocumentSequence upserts are serialized by the unique composite
  `(organizationId, documentType, year)`.
- DomainEventOutbox claims are serialized by the unique aggregate
  tuple.

## 3. Failure isolation

- A web replica failure is absorbed by the load balancer.
- A worker replica failure is absorbed by the next replica picking
  up the queue.
- A database failure is the worst-case — the readiness probe
  returns 503 and the load balancer drains traffic.
- S3 failure blocks writes but not reads (the storage layer caches
  the public asset URLs).

## 4. Boundary audit

Every request passes through three layers:

1. **Edge** — `src/middleware.ts`. Authenticates the JWT, sets the
   CSP nonce, attaches the request headers.
2. **Platform** — `src/platform/security/...`. Validates the
   authorization scope, the tenant context, and the permissions.
3. **Domain** — `src/modules/**/application/...`. Executes the
   business logic with audit, outbox, and notifications.

The Phase 11 brief calls out the optimisation opportunities at the
**platform** layer (DB query counts, cache reuse, pagination) and
the **domain** layer (N+1, heavy joins, batch operations).

## 5. Surviving "no measurable regression"

The Phase 11 brief explicitly forbids blind optimisation. The first
deliverables therefore record the **current** state — not the
optimised state. The optimisation work begins in Phase 11B-F based
on the measured numbers.

## 6. References

- `docs/performance/inventory.md` — observed state of every component.
- `docs/performance/database.md` — index / query / lock posture.
- `docs/performance/workers.md` — worker classes and concurrency.
- `docs/performance/connection-pool.md` — pool recipe.
- `docs/performance/pdf.md` — PDF performance strategy.
- `docs/performance/capacity-model.md` — capacity numbers.
- `docs/performance/scaling.md` — scaling strategy.
- `docs/performance/stress-resilience.md` — stress + recovery.
- `docs/performance/performance-budget.md` — CI gates.
- `docs/performance/dashboards-alerts.md` — observability.
- `docs/performance/load-testing.md` — cookbook.
- `docs/performance/multi-tenant.md` — tenant isolation under load.
- `docs/performance/api-frontend.md` — API + frontend budgets.
