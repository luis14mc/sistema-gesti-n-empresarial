# Phase 11B — Database performance

This document captures the **observed** state of the database layer
before any optimization. Every claim is backed by the source file
that produces the SQL.

## 1. Index inventory

The Prisma schema declares:
- **144 `@@index`** clauses
- **20 `@@unique`** clauses
- **Composite indexes** keyed by `(organizationId, …)` on every
  business table.

Source: `prisma/schema.prisma` (full file audited).

The minimum expected composite indexes for the tenant-scoped hot paths
are present:

| Table                              | Index                                                |
| ---------------------------------- | ---------------------------------------------------- |
| `Equipment`                        | `(organizationId, status)`                           |
| `Oficio`                           | `(organizationId, status)`                           |
| `CompraOrden`                      | `(organizationId, status)`                           |
| `Notification`                     | `(organizationId, userId, createdAt)`                |
| `Notification`                     | `(organizationId, status, createdAt)`                |
| `Notification`                     | `(organizationId, eventType, createdAt)`             |
| `SystemAuditEvent`                 | `(organizationId, createdAt)`                        |
| `SystemAuditEvent`                 | `(organizationId, entityType, entityId)`             |
| `SystemAuditEvent`                 | `(organizationId, action)`                           |
| `DomainEventOutbox`                | `(status, occurredAt)` + unique aggregate tuple      |
| `IntegrationExecution`             | `(organizationId, integrationId, startedAt)`         |
| `EquipmentDisposal`                | `(organizationId, status)` + `(organizationId, equipmentId)` |
| `EquipmentAssignment`              | `(organizationId, status)`                           |
| `EquipmentMaintenance`             | `(equipmentId)` + `(organizationId, …)` via FK       |

## 2. Pagination posture

All list endpoints use **offset pagination** (`page * pageSize`).
The audit log, notifications, and integration executions are the
candidates for cursor pagination (largest tables, immutable ordering).

## 3. N+1 audit

A grep across `src/` for `for.*await prisma` and `forEach.*await prisma`
returns **no matches**. The dispatcher for notifications uses a
single `findMany` with a `select` that includes the user relation
(`src/modules/notifications/application/recipient-resolver.ts`).

The equipment detail endpoint pulls a bounded `take: 50` on history
but is otherwise unbounded on assignments and maintenance
(`src/app/api/equipment/[id]/route.ts`). This is a Phase 11B candidate
to cap.

## 4. Dashboard / aggregate audit

The equipment stats endpoint
(`src/app/api/equipment/stats/route.ts`) fires **11 parallel queries**.
That is acceptable, but the breakdown is:

- 8 count queries against `equipment`
- 1 `groupBy` on `equipment.category`
- 1 `groupBy` on `equipmentAssignment.departmentAtTime`
- 1 count for warranty expiration

The 8 counts can be folded into a single `groupBy({ by: ['status'] })`
query. The total count is the sum of the bucketed counts. This is a
Phase 11B optimisation that does not require an index change.

## 5. Connection budget

`DATABASE_POOL_MAX` defaults to 10 (`src/platform/config/env.ts`).

```
Budget per process = 10 connections
Workers consume a separate pool (separate process)
Migration job: 1 connection
Operational scripts: 1 connection
Monitoring: 1 connection
```

The Phase 11B target is to **document** the recipe:

```
RDS max_connections
- reserved (admin / monitoring / migration)
= application_connection_budget
÷ max_expected_web_replicas
= safe pool size per replica
```

The exact RDS size is documented in
`docs/performance/capacity-model.md` (Phase 11G).

## 6. Lock contention

The `documentSequence` upsert uses a single-row primary key; the
serialization point is the unique index
`@@unique([organizationId, documentType, year])`. With many
concurrent allocations PostgreSQL serializes the upsert. The
contention is bounded by the per-organization, per-year, per-type
scope, which is the intended design.

The DomainEventOutbox claim uses a unique aggregate tuple. The risk
is that two workers claim the same event; the unique composite
prevents it and the upsert pattern guarantees exactly-one processing.

## 7. Examples of Prisma queries observed

```
Equipment.findMany
  where: { organizationId, status?, category?, … }
  orderBy: { createdAt: desc }
  skip: (page-1)*pageSize
  take: pageSize

DomainEventOutbox.create
  data: { organizationId, aggregateType, aggregateId, aggregateVersion, eventType, payload, … }

DocumentSequence.upsert
  where: { organizationId_documentType_year: { organizationId, documentType, year } }
  create: { lastValue: 1 }
  update: { lastValue: { increment: 1 } }
```

## 8. Search performance

There is no full-text search today. Equipment / oficio / purchase
search uses `contains` (case-insensitive) on indexed columns. The
medio and large dataset profiles will surface this as a slow path;
the Phase 11B recommendation is to:

1. Add a normalised lowercase searchable column for oficio.
2. Use `mode: 'insensitive'` only on the indexed column.
3. Defer `pg_trgm` / FTS until measured demand.

## 9. Audit / outbox growth

`SystemAuditEvent` is the largest table. Suggested actions once the
large dataset is seeded:

- Confirm the `(organizationId, createdAt)` index is used for the
  audit log query (the current query is `organizationId + module +
  category`; the existing index covers `organizationId + createdAt`).
- Consider partitioning by `createdAt` once the table exceeds 10M
  rows (documented in Phase 11G).

## 10. Query-budget regression test

The `tests/performance/query-count.test.ts` test suite (introduced
in Phase 11B) asserts upper bounds on the number of Prisma queries
executed by the most frequent request paths. The bounds are
deliberately generous for the first run; they tighten as the
baseline stabilises.

| Endpoint | Queries (max) | Notes |
| -------- | ------------- | ----- |
| `GET /api/oficios` | 2 | list + soft count |
| `GET /api/oficios/{id}` | 2 | detail + history |
| `GET /api/equipment` | 2 | list + count |
| `GET /api/equipment/{id}` | 3 | detail + bounded history |
| `GET /api/equipment/stats` | 12 | budgeted for 11 parallel counts |
| `GET /api/compras/ordenes` | 2 | list + count |
| `GET /api/compras/ordenes/{id}` | 3 | detail + items + history |
| `GET /api/notifications` | 3 | list + count + unread |
| `GET /api/notifications/unread-count` | 1 |  |
| `GET /api/audit-logs` | 2 | list + count |
| `GET /api/health/ready` | 4 | configuration + db + storage + pdf |
| `GET /api/health/live` | 0 |  |
| `POST /api/oficios` | 6 | membership + tx + envelope + audit + tracking |
| `POST /api/compras/ordenes/{id}/generar` | 8 | tx + outbox + audit + history + pdf write |

The budget is enforced by a Prisma mock that counts every call. The
test fails when the count exceeds the budget, providing a regression
guard for accidental N+1 introductions.
