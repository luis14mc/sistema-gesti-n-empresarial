# Phase 11G — Performance dashboards and alerts

## 1. Dashboards

The Phase 11G dashboard set is intentionally small. Adding a
metric costs storage and operational attention; the dashboard only
shows what the on-call would consume during an incident.

### 1.1 API performance

| Metric                          | Source                | Aggregation |
| ------------------------------- | --------------------- | ----------- |
| API p50 / p95 / p99             | k6 / runtime metrics   | 1 min avg   |
| API error rate                  | runtime metrics       | 1 min avg   |
| API requests / second           | runtime metrics       | 1 min avg   |
| API timeout count               | runtime metrics       | 1 min sum   |

### 1.2 Database

| Metric                          | Source                | Aggregation |
| ------------------------------- | --------------------- | ----------- |
| DB connections                  | pg_stat_activity      | 1 min avg   |
| DB query latency p95            | pg_stat_statements    | 1 min avg   |
| Sequential scan count           | pg_stat_user_tables   | 1 min sum   |
| Lock wait count                 | pg_stat_activity      | 1 min avg   |
| Replication lag                 | RDS console           | 1 min avg   |

### 1.3 Workers

| Metric                          | Source                | Aggregation |
| ------------------------------- | --------------------- | ----------- |
| Outbox backlog                  | DomainEventOutbox     | 1 min max   |
| Oldest outbox event age         | DomainEventOutbox     | 1 min max   |
| Job queue depth                  | job table             | 1 min max   |
| Worker CPU / memory             | runtime metrics       | 1 min avg   |
| Worker lease failures           | runtime metrics       | 1 min sum   |

### 1.4 PDF / documents

| Metric                          | Source                | Aggregation |
| ------------------------------- | --------------------- | ----------- |
| PDF p95 duration                | runtime metrics       | 1 min avg   |
| PDF error rate                  | runtime metrics       | 1 min avg   |
| PDF in-flight                   | runtime metrics       | 1 min max   |
| Chromium instances              | runtime metrics       | 1 min avg   |

### 1.5 Notifications + integrations

| Metric                          | Source                | Aggregation |
| ------------------------------- | --------------------- | ----------- |
| Notification backlog            | notification table    | 1 min max   |
| Notification error rate         | runtime metrics       | 1 min avg   |
| Webhook retry rate              | runtime metrics       | 1 min avg   |
| Integration latency p95         | runtime metrics       | 1 min avg   |

## 2. Alerts

The alert thresholds are derived from the documented capacity model
(see `docs/performance/capacity-model.md`). They are **never** set
without a measurement reason.

| Alert                          | Trigger                                  | Severity |
| ------------------------------ | ---------------------------------------- | -------- |
| API p95 regression              | p95 > baseline × 1.20 for 5 min          | P3       |
| API p95 critical                | p95 > baseline × 2.00 for 5 min          | P2       |
| API error rate                  | error_rate > 1% for 5 min                | P2       |
| API 5xx spike                   | > 10 5xx in 1 min                        | P1       |
| DB connection saturation        | usage > 75% of pool size for 1 min       | P2       |
| DB connection critical          | usage > 90% for 1 min                    | P1       |
| Outbox oldest event             | > 5 min for 10 min                       | P2       |
| Outbox stuck                    | > 30 min for 5 min                       | P1       |
| Worker queue depth              | > 5 000 for 5 min                        | P2       |
| Worker lease failures           | > 5 leases / min                         | P2       |
| PDF p95 regression              | p95 > baseline × 1.20 for 5 min          | P3       |
| PDF critical latency            | p95 > 30 s for 5 min                     | P1       |
| Notification backlog            | > 5 000 for 5 min                        | P3       |
| Webhook retry exhaustion        | > 10 retried deliveries / min            | P2       |
| Integration 5xx                 | > 5 5xx / min                            | P2       |
| Memory pressure                 | RSS > 75% of container limit for 5 min   | P2       |
| Memory critical                 | RSS > 90% for 5 min                      | P1       |

## 3. Alert routing

| Severity | Routing                              |
| -------- | ------------------------------------ |
| P1       | PagerDuty + on-call rotation + Slack |
| P2       | Slack + on-call rotation             |
| P3       | Slack                                |

## 4. Runbook

Every alert has a runbook entry in `docs/runbooks/`. The runbook
contains:

- Symptom (what the alert means).
- Likely causes (ordered by frequency).
- Mitigation steps (ordered by safety).
- Escalation path.
