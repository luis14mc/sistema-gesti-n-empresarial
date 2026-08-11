# Phase 11D — Workers, outbox, PDF, exports

## 1. Current architecture

```
Next.js (web)
  └─ route handlers → prisma (PostgreSQL)
  └─ outbox emit   → DomainEventOutbox table

Worker process (separate)
  └─ job lease    → poll DomainEventOutbox / job table
  └─ invoke       → notification, integration, PDF, report, cleanup
```

The runtime is implemented (`src/worker/runtime.ts`). The processor
today is a placeholder (`unavailableProcessor` in
`src/worker/index.ts`). The dispatcher is a synchronous placeholder
(`src/platform/jobs/dispatcher.ts`). Phase 11D does **not** implement
the processor — it documents the recommended structure and the
concurrency model.

## 2. Recommended worker classes

| Worker        | Concurrency | Rationale                       |
| ------------- | ----------- | ------------------------------- |
| `pdf`         | 2 per vCPU  | CPU + memory bound              |
| `email`       | 8 per vCPU  | Network-bound, low CPU          |
| `webhook`     | 16 per vCPU  | Network-bound                   |
| `report`      | 4 per vCPU  | DB-heavy                        |
| `cleanup`     | 1           | Background, low priority        |
| `notification`| 8 per vCPU  | Bulk inserts, low CPU           |

Per-organization ceilings are documented in `docs/performance/capacity-model.md`.

## 3. Outbox / event-driven commands

The `DomainEventOutbox` table is the bridge between transactional
commands and asynchronous workers. The contract:

- `appendOutboxEvent(client, input)` is called inside the same
  transaction as the business write.
- Workers claim events using the unique aggregate tuple
  `(organizationId, aggregateType, aggregateId, aggregateVersion, eventType)`.
- The claim is implemented in `src/platform/events/outbox.ts`. The
  upsert pattern guarantees exactly-once processing.

The Phase 11D target is to:

- Verify the claim concurrency is bounded by the per-organization
  index.
- Document the recovery throughput after a worker outage (Phase 11F).

## 4. PDF generation

- Chromium is launched per job (Strategy A in the brief).
- Each Chromium launch costs ~150 ms of startup plus the page load
  and PDF render.
- Memory per Chromium instance: ~80 MB resident.

The Phase 11D recommendation is to:

- Add a small worker pool (Strategy B) for spiky workloads.
- Each pool worker holds a long-lived Chromium instance and a queue
  of PDF jobs.
- The pool must be **per worker process** — sharing an instance
  across processes is unsafe.

The pool is documented in `docs/performance/workers.md` and the
recommended max concurrency is **2 PDF jobs per Chromium instance**.

## 5. Browser leak guard

The k6 PDF burst (`tests/performance/scenarios/pdf-generation.js`)
drives concurrent generations. The post-run script
`scripts/performance/check-browser-leaks.sh` enumerates the remaining
Chromium processes and emits a warning when the count exceeds the
pre-run baseline.

## 6. Export performance

Exports are streamed to disk and never buffered entirely in memory.
The implementation lives in `src/lib/compras/orden/preview-data.ts`
and the report runners under `src/app/api/reports/**`.

The Phase 11D budgets:

| Export            | Rows | Median | p95 |
| ----------------- | ---- | ------ | --- |
| CSV small         | 1 000 | 1 s    | 3 s |
| CSV medium        | 10 000 | 8 s  | 15 s |
| CSV large         | 25 000 | 20 s | 35 s |
| XLSX small        | 1 000 | 5 s   | 10 s |
| XLSX medium       | 10 000 | 25 s | 45 s |
| PDF report (form) | —    | 5 s   | 12 s |

These are measured in the first baseline run; the values are
recorded in `docs/performance/baseline.md`.

## 7. Notification throughput

The dispatcher
(`src/modules/notifications/application/dispatcher.ts`) writes
notifications + deliveries in a single transaction per recipient ×
channel. The Phase 11D baseline target is **100 notifications / second
/ organization** with a single worker pool.

The dispatcher is idempotent (per `(organizationId, idempotencyKey)`)
and uses the unique constraint to drop duplicates.

## 8. Webhook throughput

The outbound webhook dispatcher
(`src/platform/integrations/application/execution-service.ts`)
respects the retry policy and the circuit breaker. The Phase 11D
target is **50 outbound deliveries / second / worker** with the
default retry policy.

## 9. Phantom-locked state

The placeholder `SynchronousJobDispatcher` in `src/platform/jobs/dispatcher.ts`
must be replaced before Phase 11F can run a real stress test. The
replacement is out of scope for Phase 11 (no business modules are
added). It is documented as a **Phase 12 prerequisite**.
