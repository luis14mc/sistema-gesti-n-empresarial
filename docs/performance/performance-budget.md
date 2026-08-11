# Phase 11G — Performance budget in CI

## 1. Always-on (PR pipeline)

| Gate                              | Tool           | Threshold                        |
| --------------------------------- | -------------- | -------------------------------- |
| Lint                              | eslint         | 0 errors                         |
| Typecheck                         | tsc            | 0 errors                         |
| Unit tests                        | vitest         | 0 failures                       |
| Coverage                          | vitest         | lines ≥ 60, branches ≥ 50        |
| API envelope contract             | vitest         | 0 failures                       |
| Security regression               | vitest         | 0 failures                       |
| Build                             | next build     | 0 errors                         |
| Smoke k6 (5 VUs, 30 s)            | k6             | p95 < 1000 ms, error < 0.5%      |

## 2. Nightly

| Gate                              | Tool           | Threshold                        |
| --------------------------------- | -------------- | -------------------------------- |
| Full Vitest suite                 | vitest         | 0 failures                       |
| Full k6 load (25 VUs, 5 min)      | k6             | p95 < 1000 ms                    |
| k6 soak (25 VUs, 60 min)          | k6             | memory / connection leak guard   |
| Visual regression                | Playwright     | 1% diff tolerance                |
| Accessibility critical            | axe-core       | 0 critical violations            |
| Perf-budget regression            | k6 + compare   | < 20% diff vs baseline           |

## 3. Pre-release

| Gate                              | Tool           | Threshold                        |
| --------------------------------- | -------------- | -------------------------------- |
| k6 stress (ramp to 400 VUs)       | k6             | identify first bottleneck       |
| k6 spike (50 → 500 VUs, 10 s)     | k6             | p95 recovery < 60 s              |
| Synthetic workflow (10 tenants)   | k6             | noisy-neighbor contract met      |
| PDF burst + leak check            | k6 + script    | no Chromium leak                 |
| Outbox recovery (1 000 events)    | k6 + worker    | drain ≤ 5 min                    |
| Bundle budget                     | bundle         | within documented budgets        |

## 4. Cost / risk

| Risk                              | Mitigation                                  |
| --------------------------------- | ------------------------------------------- |
| Heavy k6 saturates the staging DB | Use the `medium` dataset only for nightly    |
| PDF burst leaks Chromium          | Pre/post process check + fail on delta > 0  |
| Spike test triggers the rate limiter | Expected; the metric we want is recovery time |

## 5. Performance-budget regression

The threshold is documented in `docs/performance/objectives.md`. The
comparison script (`scripts/performance/compare-baseline.mjs`) emits
a `reports/perf-compare.json` and exits with code 2 when a
**blocking** regression is detected. The nightly workflow surfaces
the warning.
