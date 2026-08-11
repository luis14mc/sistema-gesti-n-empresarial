# Phase 11A — Performance objectives (engineering SLOs)

These are **engineering targets**, not contractual SLAs. They are
chosen to be conservative enough to be achievable on the current
hardware profile and aggressive enough to surface real regressions.

| Surface                        | Target p50 | Target p95 | Target p99 | Notes |
| ------------------------------ | ---------- | ---------- | ---------- | ----- |
| API list endpoints             | 200 ms     | 500 ms     | 1 000 ms   | Pagination + tenant filter required. |
| API detail endpoints           | 150 ms     | 400 ms     | 800 ms     | Single entity look-up. |
| Simple commands                | 300 ms     | 700 ms     | 1 500 ms   | No PDF, no external call. |
| Dashboard summary              | 600 ms     | 1 500 ms   | 3 000 ms   | Aggregated, parallel queries. |
| Search endpoints               | 350 ms     | 700 ms     | 1 500 ms   | Indexed search only. |
| Authentication login           | 400 ms     | 800 ms     | 1 500 ms   | JWT signing + audit write. |
| Organization switch            | 300 ms     | 700 ms     | 1 500 ms   | Context re-resolution. |
| Outbox dispatch                | 80 ms      | 200 ms     | 400 ms     | Single outbox row write. |
| Background job dispatch        | 150 ms     | 300 ms     | 600 ms     | Enqueue + claim. |
| PDF generation (small form)   | 2 s        | 5 s        | 12 s       | Puppeteer per-job. |
| CSV export ≤ 10k rows          | 3 s        | 8 s        | 15 s       | Streamed to disk. |
| Large report async export      | queue      | queue      | queue      | Background job, never blocking. |

## 3. SLO reporting matrix

Every measured scenario produces a row with:

| Scenario           | p50 | p95 | p99 | error_rate | rps | corr   |
| ------------------ | --- | --- | --- | ---------- | --- | ------ |
| list-oficios       |     |     |     |            |     | commit |
| detail-oficio      |     |     |     |            |     | commit |
| list-equipment     |     |     |     |            |     | commit |
| detail-equipment   |     |     |     |            |     | commit |
| list-purchases     |     |     |     |            |     | commit |
| detail-purchase    |     |     |     |            |     | commit |
| list-notifications |     |     |     |            |     | commit |
| dashboard          |     |     |     |            |     | commit |
| pdf-generation     |     |     |     |            |     | commit |
| csv-export         |     |     |     |            |     | commit |

Results are committed to `docs/performance/baseline.md` and **never
deleted**. The next phase compares against the baseline.

## 4. Performance regression thresholds

A regression is **warning** when:
- p95 grows > 10% over the committed baseline.
- p99 grows > 15% over the committed baseline.
- Error rate grows > 0.1 percentage points.

A regression is **blocking** when:
- p95 grows > 20% over the committed baseline.
- p99 grows > 25% over the committed baseline.
- Error rate grows > 0.5 percentage points.
- Memory > 20% growth without justification.

The block/warn thresholds are evaluated by the nightly performance
workflow (`tests/performance/scripts/compare-baseline.mjs`).
