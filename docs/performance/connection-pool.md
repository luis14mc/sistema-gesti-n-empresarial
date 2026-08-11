# Phase 11B — Connection pool and lock contention

## 1. PostgreSQL connection budget

The platform uses a single Prisma client per process backed by
`pg.Pool`. `DATABASE_POOL_MAX` defaults to 10
(`src/platform/config/env.ts`).

Phase 11B introduces the following recipe:

```
RDS max_connections
- reserved_admin         (mitigation, replication, monitoring)
- reserved_migration     (1 connection for migrations)
- reserved_observability (1 connection for live health checks)
= application_connection_budget
÷ max_expected_web_replicas
= safe_pool_size_per_replica
```

The worker pool is sized independently. A worker process is typically
configured with `DATABASE_POOL_MAX=5` (most of the work is async),
and the queue is bounded so the connection pool never saturates.

## 2. Trade-offs

| Option             | Pros                              | Cons                                        |
| ------------------ | --------------------------------- | ------------------------------------------- |
| Prisma `pg.Pool`   | Built-in, no extra infra          | Per-process, no sharing across replicas    |
| PgBouncer          | Single shared pool                | Adds infra, statement-level only (no session) |
| RDS Proxy          | IAM auth, pooling                 | Adds infra, latency to DB hop               |
| Neon pooler        | Built-in if we ever move         | Vendor lock-in                              |

The Phase 11B recommendation is to **stay with Prisma `pg.Pool`** for
the first capacity model. The deployment is multi-replica; the
total connection count is bounded by `replicas × DATABASE_POOL_MAX`.

When the total approaches 60% of `max_connections`, introduce RDS
Proxy (or PgBouncer in transaction mode) with a session-mode router.
Documented as a Phase 11G follow-up if the measurement demands it.

## 3. Lock contention

The most contended resources are:

1. `DocumentSequence` upsert — serialized by the unique composite
   `(organizationId, documentType, year)`. Per-organization, per-year,
   per-type. The contention is bounded by design.
2. `DomainEventOutbox` claim — serialized by the unique composite
   `(organizationId, aggregateType, aggregateId, aggregateVersion, eventType)`.
   Workers claim each event exactly once.

The k6 stress scenario (`tests/performance/scenarios/stress.js`) is
the right place to observe lock waits once the live processor is
wired. Pre-Phase 12, no measurement is possible.

## 4. Deadlock strategy

The platform is intentionally short-lived on transactions. The
recommended retry policy lives in the Prisma client:

```
maxRetries: 2
retryStrategy: PRISMA_RETRY_TRANSIENT_ERRORS
```

The error catalogue (`src/platform/domain/errors.ts`) tags
serialization failures (`P2034`) and deadlocks (`P2034`) so the
retry can recognize them. Phase 11B documents this in
`docs/performance/connection-pool.md` for completeness.

## 5. Recommendations

- Keep the per-replica pool at 10 for the web tier.
- Keep the per-worker pool at 5 for the worker tier.
- Total = (web replicas × 10) + (worker replicas × 5) + 4 reserved.
- Re-evaluate at the first deployment with 3+ web replicas and 2+
  worker replicas.
