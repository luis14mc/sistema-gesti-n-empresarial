# Phase 11G — Load testing cookbook

## 1. Directory layout

```
tests/performance/
  config/                    ← shared config (currently empty, future)
  scenarios/
    smoke.js                 ← liveness + readiness
    load.js                  ← realistic traffic mix
    stress.js                ← ramp until degradation
    spike.js                 ← 50 → 500 VUs
    soak.js                  ← 60-minute sustained
    pdf-generation.js        ← PDF burst
    multi-tenant.js          ← 10 organizations × 5 users
  helpers/                    ← (currently empty, future)
  datasets/
    README.md                ← where the synthetic data lives
  baselines/
    README.md                ← where the baseline numbers live
  scenarios/scenarios        ← (k6 reads from scenarios/)
```

## 2. Prerequisites

- k6 installed locally (`brew install k6` / `apt install k6`).
- The target environment is staging — never production.
- `BASE_URL` and `TOKEN` (test JWT) exported.
- The synthetic dataset generated via
  `scripts/performance/generate-dataset.ts --profile small --yes`.

## 3. Running the suites

```bash
# Smoke: 5 VUs, 30 s. Always safe.
k6 run tests/performance/scenarios/smoke.js

# Load: 25 VUs, 5 min. Requires the medium dataset.
k6 run tests/performance/scenarios/load.js

# Stress: ramp to 400 VUs. Requires the large dataset.
k6 run tests/performance/scenarios/stress.js

# Spike: 50 → 500 VUs in 10 s.
k6 run tests/performance/scenarios/spike.js

# Soak: 25 VUs, 60 min. Reveals leaks.
k6 run tests/performance/scenarios/soak.js

# PDF burst: 5 PDFs / second, 2 min.
k6 run tests/performance/scenarios/pdf-generation.js

# Multi-tenant: 50 VUs, 5 min.
k6 run tests/performance/scenarios/multi-tenant.js
```

## 4. Comparing against the baseline

```bash
# Run the load test and capture the summary.
k6 run --summary-export=reports/perf-summary.json \
  tests/performance/scenarios/load.js

# Compare against the committed baseline.
node scripts/performance/compare-baseline.mjs
```

The script fails when a regression exceeds the documented threshold.

## 5. Reporting

- `reports/perf-summary.json` — the raw k6 summary.
- `reports/perf-compare.json` — the comparison output.
- `docs/performance/baseline.md` — the committed baseline.

The CI workflow uploads the summary + comparison as artifacts.
