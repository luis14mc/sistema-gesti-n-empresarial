# Phase 11F — Stress, resilience, recovery

## 1. Stress / spike / soak

The k6 scenarios are committed under `tests/performance/scenarios/`:

| Scenario             | Purpose                          | When                          |
| -------------------- | -------------------------------- | ----------------------------- |
| `smoke.js`           | Liveness + readiness             | Every PR                      |
| `load.js`            | Realistic traffic mix            | Nightly                       |
| `stress.js`          | Ramp until degradation           | Manual / pre-release          |
| `spike.js`           | 50 → 500 VU sudden bounce        | Manual / pre-release          |
| `soak.js`            | 60 minutes sustained 25 VUs      | Nightly                       |
| `pdf-generation.js`  | PDF burst + leak detection      | Manual / pre-release          |
| `multi-tenant.js`    | 10 organizations × 5 users       | Manual / pre-release          |

The first bottleneck is recorded in
`docs/performance/baseline.md`.

## 2. Failure-injection matrix

The k6 scenarios tolerate the following injected failures when the
environment is configured to enable them:

| Failure                       | Expected behavior                       |
| ----------------------------- | --------------------------------------- |
| PostgreSQL latency +1 s       | Requests stall; pool drains; 5xx rise   |
| PostgreSQL transient failure  | Retry; bounded retry budget; 5xx        |
| S3 unavailable                | Storage 5xx; retry                      |
| Worker stopped                | Outbox backlog grows; resumes on restart |
| PDF browser crash mid-job     | Worker's processor aborts the job and retries |
| Email provider timeout        | Email delivery retried with backoff    |
| Graph / Identity timeout      | OAuth retries; user sees "in progress"  |

## 3. Outbox recovery

Scenario:

1. Stop the worker process.
2. Drive 1 000 commands so the outbox accumulates 1 000 events.
3. Wait.
4. Restart the worker.
5. Verify the backlog is drained with no duplicates.

The acceptance contract is in `tests/performance/outbox-recovery.test.ts`.

## 4. PDF worker outage

When the PDF worker is down:

- The API route that triggers the PDF generation returns a
  `503 SERVICE_UNAVAILABLE` with a `Retry-After` header.
- The outbox event remains in the queue.
- The user-facing notification says "PDF pending — you'll be
  notified when ready".

The recovery test is in `tests/performance/pdf-outage.test.ts`.

## 5. Worker recovery throughput

The recovery throughput is the rate at which the worker drains the
backlog after a restart. The Phase 11F target is to drain a
1 000-event backlog within **5 minutes** with a single worker
process.

## 6. Soak tests

The 60-minute soak is intended to surface:

- Memory leaks in either the Next.js server or the worker.
- Database connection pool leaks.
- Temp file accumulation in the storage layer.
- Chromium process leaks.

The leak detection script (`scripts/performance/check-browser-leaks.sh`)
is the post-run guard.

## 7. Spike recovery

The spike scenario (50 → 500 VUs in 10 s) confirms:

- The rate limiter rejects excess requests with `429`.
- The database connection pool recovers after the burst.
- The worker queue size returns to baseline within 5 minutes.

## 8. Failure injection script

`scripts/performance/inject-failures.sh` is a stub that documents
the failure modes. The actual implementation requires access to the
staging environment and is **never** run against production.

## 9. Recovery matrix

The recovery matrix is committed in
`docs/performance/recovery-matrix.md`. When measured, every cell
must answer:

- RTO (recovery time objective)
- RPO (recovery point objective)
- Data loss risk
- Manual interventions required
