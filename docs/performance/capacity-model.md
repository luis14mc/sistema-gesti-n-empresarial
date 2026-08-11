# Phase 11G — Capacity model

This document is the authoritative answer to "how many users can
the platform support?" — it is the **target** until the first
baseline run replaces the numbers under "measured".

## 1. Hardware profile

The target deployment is a single AWS region with:

| Tier        | Resource (small) | Resource (medium) | Resource (large) |
| ----------- | ---------------- | ----------------- | ---------------- |
| Web         | 2 × 1 vCPU, 2 GB | 4 × 2 vCPU, 4 GB  | 8 × 4 vCPU, 8 GB |
| Worker      | 1 × 2 vCPU, 4 GB | 2 × 4 vCPU, 8 GB  | 4 × 8 vCPU, 16 GB |
| PostgreSQL  | db.r6g.large     | db.r6g.xlarge     | db.r6g.2xlarge   |
| Storage     | S3 standard      | S3 standard       | S3 standard      |

The numbers are conservative. The first measurement is expected to
revise them.

## 2. Capacity numbers

| Metric                          | Small | Medium | Large |
| ------------------------------- | ----- | ------ | ----- |
| Organizations                    | 50    | 500    | 5 000 |
| Concurrent users                | 100   | 1 000  | 10 000 |
| Active sessions                  | 200   | 2 000  | 20 000 |
| Requests / second (sustained)    | 50    | 250    | 1 000 |
| Requests / second (peak)         | 200   | 1 000  | 4 000 |
| Database size                    | 5 GB  | 50 GB  | 500 GB |
| Storage (S3)                     | 20 GB | 200 GB | 2 TB |
| Concurrent PDFs                  | 4     | 16     | 64     |
| Notifications / second           | 30    | 150    | 600   |
| Webhooks / second (outbound)     | 10    | 50     | 200   |

## 3. Thresholds

| Signal              | Warning      | Scale       | Hard limit |
| ------------------- | ------------ | ----------- | ---------- |
| API p95             | +20% baseline| +50% baseline| 2× baseline |
| API error rate      | > 0.5%       | > 1.0%      | > 2.0%     |
| DB connections      | > 60%        | > 75%       | > 90%      |
| Worker queue depth  | > 1 000      | > 5 000     | > 25 000   |
| Outbox oldest event | > 60 s       | > 5 min     | > 30 min   |
| PDF p95             | +20% baseline| +50% baseline| > 30 s    |
| Memory RSS          | > 60%        | > 75%       | > 90%      |

## 4. Auto-scaling signals

| Tier      | Up signal                          | Down signal                |
| --------- | ---------------------------------- | -------------------------- |
| Web       | CPU > 60% (5 min), p95 +20%       | CPU < 30% (15 min)         |
| Worker    | OutstandingJobs > 500             | OutstandingJobs < 50       |
| Database  | connection saturation > 60%       | not applicable              |

The worker does **not** autoscale on CPU alone — most jobs are
network-bound or DB-bound.

## 5. Capacity headroom

Every measurement carries a 30% headroom margin before the "scale"
threshold fires. The hard limit is reached at 200% of the baseline.

## 6. Cost model

The Phase 11G cost model is documented separately in
`docs/performance/cost-model.md` (introduced in Phase 11G).

## 7. What to measure first

The first capacity model is informed by:

1. **Small dataset** (5 orgs, 100 users, 1k equipment).
2. **Medium dataset** (25 orgs, 1k users, 25k equipment).
3. **Large dataset** (100 orgs, 5k users, 250k equipment).

The first numbers are filled in the first baseline run. The
procedure is run for every release candidate.
