# Phase 11 — Staging validation checklist

> **Purpose**: this is the executable companion to the Phase 11
> closure report. The closure report is **structurally complete**;
> the items in this checklist are the **measurements** that must be
> executed against staging before Phase 11 can be honestly marked
> complete.
>
> **Prerequisites**: a staging environment that satisfies
> § "Required infrastructure" below. The checklist is **not** meant
> to be executed in the development sandbox.

---

## Required infrastructure

| Component | Required for |
| --- | --- |
| PostgreSQL staging (≥ db.r6g.large, ≥ 100 connections) | Database measurements, lock contention, capacity model |
| Synthetic dataset (`small` / `medium` / `large`) | All realistic load tests |
| k6 binary | All load scenarios |
| Chromium (managed, `PUPPETEER_EXECUTABLE_PATH` set) | PDF measurements, leak detection |
| Real worker processor | All worker / outbox / notification / PDF / webhook measurements |
| Observability emission (CPU, memory, DB connections) | Capacity model, scaling plan |

---

## 1. Staging PostgreSQL baseline

```bash
# 1. Apply the migrations.
APP_ENV=staging DATABASE_URL=… pnpm prisma migrate deploy

# 2. Validate the schema.
pnpm prisma validate
pnpm prisma generate

# 3. Seed the small dataset.
APP_ENV=staging \
  PERFORMANCE_TEST_MODE=true \
  DATABASE_URL=… \
  tsx scripts/performance/generate-dataset.ts --profile small --yes

# 4. Verify the row counts.
APP_ENV=staging DATABASE_URL=… psql -c "
  select 'organizations' as t, count(*) from organizations where id like 'perf-%';
  select 'users' as t, count(*) from \"User\" where id like 'perf-%';
  select 'equipment' as t, count(*) from \"Equipment\" where id like 'perf-eq-%';
  select 'oficios' as t, count(*) from \"Oficio\" where id like 'perf-ofc-%';
  select 'purchase_orders' as t, count(*) from \"CompraOrden\" where id like 'perf-po-%';
  select 'audit_events' as t, count(*) from \"SystemAuditEvent\" where entity_type = 'Perf';
"

# 5. Capture the connection pool size.
APP_ENV=staging DATABASE_URL=… psql -c "
  select count(*), application_name
  from pg_stat_activity
  group by application_name;
"

# 6. Record the baseline in docs/performance/baseline.md.
```

**Acceptance**: row counts match the profile; connection pool count
is ≤ `DATABASE_POOL_MAX × replicas`.

---

## 2. p50/p95/p99 API measurements

```bash
# 1. Generate a JWT for the E2E_ADMIN user (use the existing login).
# 2. Run the load scenario.
BASE_URL=https://staging.cni.example.test \
  TOKEN=… \
  k6 run --summary-export=reports/perf-summary.json \
  tests/performance/scenarios/load.js

# 3. Compare against the baseline.
node scripts/performance/compare-baseline.mjs

# 4. Record the numbers in docs/performance/baseline.md.
```

**Acceptance per scenario**:

| Scenario | p95 target | Status |
| --- | --- | --- |
| list-oficios | ≤ 500 ms | ⏳ |
| detail-oficio | ≤ 400 ms | ⏳ |
| list-equipment | ≤ 500 ms | ⏳ |
| detail-equipment | ≤ 400 ms | ⏳ |
| list-purchases | ≤ 500 ms | ⏳ |
| detail-purchase | ≤ 400 ms | ⏳ |
| list-notifications | ≤ 500 ms | ⏳ |
| dashboard | ≤ 1500 ms | ⏳ |
| pdf-generation | ≤ 12 s | ⏳ |
| csv-export | ≤ 10 s | ⏳ |

A scenario is **honestly completed** only when the measured p95 is
recorded in `docs/performance/baseline.md` with the run metadata
(commit SHA, dataset, VUs, duration).

---

## 3. EXPLAIN ANALYZE of critical queries

```bash
# 1. Connect to staging.
APP_ENV=staging DATABASE_URL=… psql

# 2. Document the queries in docs/performance/database.md (§10).
# 3. Run EXPLAIN (ANALYZE, BUFFERS) on each.

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM "CompraOrden"
WHERE "organizationId" = $1 AND status = 'DRAFT'
ORDER BY "createdAt" DESC
LIMIT 20 OFFSET 0;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM "SystemAuditEvent"
WHERE "organizationId" = $1 AND action = 'UPDATE'
ORDER BY "createdAt" DESC
LIMIT 50 OFFSET 0;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM "Notification"
WHERE "organizationId" = $1 AND "userId" = $2
ORDER BY "createdAt" DESC
LIMIT 20;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM "DocumentSequence"
WHERE "organizationId" = $1 AND "documentType" = $2 AND "year" = $3;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM "Equipment"
WHERE "organizationId" = $1 AND status = 'AVAILABLE'
ORDER BY "createdAt" DESC
LIMIT 20 OFFSET 0;
```

**Acceptance**: every query uses an index scan, not a sequential
scan, on the medium dataset. Sequential scans observed must be
documented with a rationale.

---

## 4. Worker throughput

```bash
# 1. Start the worker.
APP_ENV=staging WORKER_ENABLED=true DATABASE_URL=… pnpm start:worker

# 2. Drive 1 000 events through the outbox.
APP_ENV=staging DATABASE_URL=… \
  k6 run --vus 10 --duration 5m \
  BASE_URL=https://staging.cni.example.test \
  TOKEN=… \
  tests/performance/scenarios/load.js

# 3. Observe the outbox backlog.
APP_ENV=staging DATABASE_URL=… psql -c "
  select status, count(*) from \"DomainEventOutbox\"
  group by status;
  select min(\"occurredAt\") from \"DomainEventOutbox\" where status = 'PENDING';
"

# 4. Record jobs/minute, p95 duration, failure rate.
```

**Acceptance**: each worker class reaches the documented throughput
target in `docs/performance/workers.md` §2. No worker class exceeds
its documented concurrency ceiling.

---

## 5. DomainEventOutbox drain / recovery

```bash
# 1. Stop the worker.
systemctl stop sge-worker

# 2. Drive 1 000 commands so the outbox accumulates.
APP_ENV=staging DATABASE_URL=… \
  k6 run --vus 5 --duration 2m \
  BASE_URL=https://staging.cni.example.test \
  TOKEN=… \
  tests/performance/scenarios/load.js

# 3. Wait 10 minutes.
sleep 600

# 4. Confirm the backlog is visible.
APP_ENV=staging DATABASE_URL=… psql -c "
  select count(*) from \"DomainEventOutbox\" where status = 'PENDING';
  select max(\"occurredAt\") from \"DomainEventOutbox\";
"

# 5. Restart the worker.
systemctl start sge-worker

# 6. Measure the drain time.
START=$(date +%s)
while [ $(APP_ENV=staging DATABASE_URL=… psql -tAc "select count(*) from \"DomainEventOutbox\" where status = 'PENDING';") -gt 0 ]; do
  sleep 5
done
END=$(date +%s)
echo "Drain time: $((END - START)) seconds"
```

**Acceptance**: the backlog drains within 5 minutes
(`tests/performance/outbox-recovery.test.ts` contract). No
duplicates are observed (the unique composite guarantees this).

---

## 6. PDF concurrency

```bash
# 1. Drive 1 PDF / second for 2 minutes.
BASE_URL=https://staging.cni.example.test \
  TOKEN=… \
  ORDER_ID=perf-po-1 \
  k6 run tests/performance/scenarios/pdf-generation.js

# 2. Observe Chromium process count.
pgrep -af 'chrome|chromium' | wc -l

# 3. Repeat with 2 / 5 / 10 / 20 concurrent jobs.
# 4. Record throughput, latency, RSS, failure rate per concurrency.
```

**Acceptance**: the documented safe limit (`≤ 2 per vCPU`) is
confirmed. Throughput degrades gracefully; no PDF exceeds the
documented timeout.

---

## 7. Chromium leak detection

```bash
# 1. Record the baseline.
BASELINE=$(pgrep -af 'chrome|chromium' | wc -l | tr -d ' ')
echo "baseline: $BASELINE"

# 2. Run the PDF burst.
BASE_URL=https://staging.cni.example.test \
  TOKEN=… \
  k6 run tests/performance/scenarios/pdf-generation.js

# 3. Run the leak detection script.
THRESHOLD=0 bash scripts/performance/check-browser-leaks.sh
```

**Acceptance**: the post-burst count returns to the baseline (delta
≤ 0). Failure here is a P1 alert and blocks the release.

---

## 8. Multi-tenant noisy-neighbor testing

```bash
# 1. Drive Tenant A with 10 concurrent PDF jobs.
BASE_URL=https://staging.cni.example.test \
  TOKEN=… \
  ORDER_ID=perf-po-1 \
  k6 run --vus 10 --duration 5m tests/performance/scenarios/pdf-generation.js &

# 2. In parallel, drive Tenant B with normal CRUD.
BASE_URL=https://staging.cni.example.test \
  TOKEN=… \
  ORG_ID=perf-org-0002 \
  k6 run tests/performance/scenarios/load.js

# 3. Record Tenant B's p95 and error rate.
# 4. Compare against Tenant B's solo baseline.
```

**Acceptance** (per `tests/performance/noisy-neighbor.test.ts`):

- Tenant B's p95 stays within +20% of its solo baseline.
- Tenant B's error rate does not exceed 0.5%.

---

## 9. Stress testing

```bash
# 1. Run the ramp scenario.
BASE_URL=https://staging.cni.example.test \
  TOKEN=… \
  k6 run tests/performance/scenarios/stress.js

# 2. Capture the first bottleneck.
node scripts/performance/compare-baseline.mjs

# 3. Record the bottleneck in docs/performance/baseline.md.
```

**Acceptance**: the first bottleneck is documented (CPU, memory,
DB connections, or worker backlog). Apply 30% headroom before the
"scale" threshold.

---

## 10. Spike recovery

```bash
# 1. Run the spike scenario.
BASE_URL=https://staging.cni.example.test \
  TOKEN=… \
  k6 run tests/performance/scenarios/spike.js

# 2. Observe the time-to-recovery (p95 returns to baseline).
# 3. Record the recovery time in docs/performance/baseline.md.
```

**Acceptance**: p95 returns to within 10% of the pre-spike baseline
within 60 seconds of the spike ending.

---

## 11. 60-minute soak testing

```bash
# 1. Run the soak scenario.
BASE_URL=https://staging.cni.example.test \
  TOKEN=… \
  k6 run tests/performance/scenarios/soak.js

# 2. Sample RSS and connection count every 5 minutes.
# 3. Verify the leak guard.
bash scripts/performance/check-browser-leaks.sh
```

**Acceptance**: memory growth is ≤ 20% from T+5 to T+60. No
Chromium leak. No DB connection leak.

---

## 12. Final bottleneck identification

After all previous steps:

```bash
# 1. Identify the first ceiling in docs/performance/baseline.md.
# 2. Update docs/performance/capacity-model.md with the actual numbers.
# 3. Update docs/performance/scaling.md with the verified strategy.
# 4. Update docs/performance/dashboards-alerts.md with the calibrated
#    thresholds.
```

**Acceptance**: every threshold in `dashboards-alerts.md` is
backed by a measured number + 30% headroom.

---

## 13. Final capacity-model update

```bash
# 1. Repeat the small / medium / large runs.
# 2. Fill the per-scope numbers in docs/performance/capacity-model.md.
# 3. Update docs/performance/baseline.json with the real numbers.
# 4. Commit the updated files. They are append-only — never delete
#    a previous run.
```

**Acceptance**: `docs/performance/baseline.md` is no longer
"PENDING" for any scenario. Every scenario carries:

- commit SHA
- date
- environment
- dataset
- p50 / p95 / p99
- error rate
- rps
- bottleneck

---

## Signature

When every section above is completed, the release manager signs
the closure-report.md:

```
Reviewed by: ____________________
Date:         ____________________
Baseline SHA: ____________________
```

Phase 11 is then **honestly complete** and Phase 12 may begin.
