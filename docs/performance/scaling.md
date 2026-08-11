# Phase 11G — Scaling strategy

## 1. Components classification

| Component          | Stateless | Stateful | CPU-bound | Memory-bound | DB-bound | Network-bound |
| ------------------ | --------- | -------- | --------- | ------------ | -------- | ------------- |
| Web replicas       | ✅        | —        | partial   | partial      | partial  | partial       |
| Worker replicas    | ✅        | —        | partial   | partial      | partial  | partial       |
| PostgreSQL         | —         | ✅       | —         | ✅           | ✅       | —             |
| S3 storage         | —         | ✅       | —         | —            | —        | ✅            |
| Puppeteer (per job)| —         | —        | ✅        | ✅           | —        | —             |

## 2. Vertical scaling

Vertical scaling is the short-term response. The limits are:

- **Web replica**: 4 vCPU / 8 GB is the practical ceiling before
  Next.js single-threaded bottlenecks appear.
- **Worker replica**: 8 vCPU / 16 GB is the practical ceiling before
  Chromium memory pressure becomes a problem.
- **PostgreSQL**: 16xlarge for the read replicas; beyond that the
  sharding strategy must be introduced.

## 3. Horizontal scaling

| Component   | Stateless | Replicas | Trigger                          |
| ----------- | --------- | -------- | -------------------------------- |
| Web         | yes       | 2 – 16   | CPU, p95, request count          |
| Worker      | yes       | 1 – 8    | Outbox backlog, oldest event age |
| PostgreSQL  | primary + read replicas | 1 + 1..3 | Connection saturation, read p95 |
| S3          | managed   | n/a      | n/a                              |

## 4. Database scaling

The first scaling step is **read replicas** (PgBouncer in transaction mode).
The second step is **vertical scaling** (bigger RDS instance class).
The third step is **sharding by organizationId** — only when the
single primary exceeds 1 TB or 10 000 connections.

Sharding is **not** planned in Phase 11.

## 5. Worker scaling

The worker is the easiest component to scale horizontally:

- Each worker claims events from the outbox using the unique
  aggregate tuple.
- Workers can be added or removed without disrupting the queue.
- The shutdown signal (`SIGTERM`) is propagated through
  `WorkerRuntime.shutdown()` with a configurable timeout.

## 6. PDF scaling

PDF generation is the heaviest workload. The recommended scale-up
sequence is:

1. Increase per-instance pool from 2 → 4 (more in-flight PDFs).
2. Add a worker replica (more parallel instances).
3. Extract the PDF worker to a dedicated service (Strategy C).

The dedicated service is optional — it is recommended only when the
main application process is too CPU-bound.

## 7. Storage scaling

S3 is managed. The platform uses versioned buckets with lifecycle
rules:

- Hot tier: 0 – 30 days.
- Infrequent access: 30 – 365 days.
- Glacier: 365 days +.

The lifecycle policy is configured in the staging environment and
copied to production.

## 8. Connection-pool scaling

The connection pool is the first bottleneck in any horizontal
scaling story. The Phase 11B recipe is documented in
`docs/performance/connection-pool.md`.

## 9. Cache scaling

The platform does not yet use a distributed cache. The first
candidate is **ElastiCache Redis** — introduced only when the
per-request `requireOrganizationContext` cost is measured as a
material part of the API p95.

## 10. Cost implications

The cost implications of each scaling step are documented in
`docs/performance/cost-model.md`. The Phase 11G policy is to
prefer the **simplest** change that meets the measured demand.
