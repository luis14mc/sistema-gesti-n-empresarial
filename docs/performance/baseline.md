# Phase 11A — Baseline report

This file is the **first** baseline run on the synthetic dataset. It
is committed alongside the seed script and the comparison script. The
numbers below are the targets, not yet the measured results.

> The repo does not yet have a live PostgreSQL instance wired to the
> staging environment. The first real baseline run is performed by
> the release engineering team on the staging environment. The
> placeholder fields below are filled in by the runbook described in
> `scripts/performance/compare-baseline.mjs`.

## Run metadata

| Field | Value |
| ----- | ----- |
| Commit SHA | _to be filled at the first run_ |
| Date | _to be filled at the first run_ |
| Environment | staging |
| Dataset profile | small (first run), medium (second), large (third) |

## Measured scenarios

| Scenario | p50 | p95 | p99 | error_rate | rps | vs target |
| -------- | --- | --- | --- | ---------- | --- | --------- |
| list-oficios | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| detail-oficio | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| list-equipment | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| detail-equipment | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| list-purchases | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| detail-purchase | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| list-notifications | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| dashboard | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| pdf-generation | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| csv-export | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |

## First bottleneck

To be filled after the first stress test (`tests/performance/scenarios/stress.js`).
Indicates:

- CPU / memory / connection saturation point.
- Worker backlog growth.
- Database connection waiting.

## Connection pool

To be filled after the first soak test. Default `DATABASE_POOL_MAX=10`.

## Notes

The placeholder values are intentional. As soon as the first k6 run
is executed on staging, the numbers are committed and serve as the
baseline for every subsequent Phase 11 measurement. The file is
**never truncated** — additional rows are appended below the baseline.
