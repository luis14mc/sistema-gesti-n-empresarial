# Phase 11A — Performance inventory

This document captures the **observed** state of the system before any
optimization. Every claim is paired with the source file/line that
backs it. No optimization is performed until the baseline run is
committed.

## 1. Runtime snapshot

| Component              | Value (source)                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Node.js engine         | `>=22.12.0 <23 || >=24 <25` (`package.json`)                                                                                |
| Framework              | Next.js `16.2.11` (`package.json`)                                                                                         |
| Build target           | `output: 'standalone'` (`next.config.js`)                                                                                   |
| Worker bundler         | `esbuild` → `dist/worker/index.js` (`package.json`)                                                                         |
| Connection pool max    | `DATABASE_POOL_MAX` default 10 (`src/platform/config/env.ts`)                                                              |
| Pool idle timeout      | `DATABASE_IDLE_TIMEOUT_MS` default 30 000 ms (`env.ts`)                                                                     |
| Connection acquire     | `DATABASE_CONNECTION_TIMEOUT_MS` default 5 000 ms (`env.ts`)                                                               |
| Worker poll interval   | `WORKER_POLL_INTERVAL_MS` default 2 000 ms (`env.ts`)                                                                      |
| Worker shutdown        | `WORKER_SHUTDOWN_TIMEOUT_MS` default 25 000 ms (`env.ts`)                                                                   |
| Health check timeout   | `HEALTH_CHECK_TIMEOUT_MS` default 3 000 ms (`env.ts`)                                                                      |

## 2. Critical endpoints (read-heavy)

| Endpoint                                 | Handler evidence                                       |
| ---------------------------------------- | ------------------------------------------------------ |
| `GET /api/oficios`                       | `src/app/api/oficios/route.ts`                         |
| `GET /api/oficios/{id}`                  | `src/app/api/oficios/[id]/route.ts`                   |
| `GET /api/equipment`                     | `src/app/api/equipment/route.ts`                       |
| `GET /api/equipment/{id}`                | `src/app/api/equipment/[id]/route.ts`                 |
| `GET /api/compras/ordenes`               | `src/app/api/compras/ordenes/route.ts`                 |
| `GET /api/compras/ordenes/{id}`          | `src/app/api/compras/ordenes/[id]/route.ts`            |
| `GET /api/notifications`                 | `src/app/api/notifications/route.ts`                   |
| `GET /api/notifications/unread-count`    | `src/app/api/notifications/unread-count/route.ts`      |
| `GET /api/reports/catalog`               | `src/app/api/reports/catalog/route.ts`                 |
| `GET /api/audit-logs`                    | `src/app/api/audit-logs/route.ts` (delegated to `src/platform/security/audit/audit-log-query-service.ts`) |
| `GET /api/equipment/stats`               | `src/app/api/equipment/stats/route.ts`                 |
| `GET /api/organizations/current`         | `src/app/api/organizations/current/route.ts`           |

## 3. Critical commands (write-heavy)

| Command                          | Handler evidence                                            |
| -------------------------------- | ----------------------------------------------------------- |
| Create / update oficio           | `src/app/api/oficios/[id]/route.ts` + `services/oficios.service.ts` |
| Create purchase draft            | `src/app/api/compras/ordenes/route.ts`                      |
| Generate purchase order          | `src/app/api/compras/ordenes/[id]/generar/route.ts`         |
| Equipment assignment             | `src/app/api/equipment-assignments/route.ts`                |
| Disposal submit / approve        | `src/app/api/equipment-disposal/.../route.ts` (service in `src/modules/equipment-disposal/application/service.ts`) |
| Switch organization              | `src/modules/organizations/application/context.ts` (`requireOrganizationContext`) |
| Mark notification read           | `src/modules/notifications/application/queries.ts`         |

## 4. Database hot spots

| Concern                              | Source                                                          |
| ------------------------------------ | --------------------------------------------------------------- |
| Document sequence allocation        | `src/platform/sequences/document-sequence.ts` (upsert + increment) |
| Outbox write per transaction         | `src/platform/events/outbox.ts` (`appendOutboxEvent`)          |
| Outbox polling claim                 | (no live dispatcher — `src/platform/jobs/dispatcher.ts` is a `SynchronousJobDispatcher` placeholder) |
| Audit log query                      | `src/platform/security/audit/audit-log-query-service.ts`      |
| Notification tenant-scoped list      | `src/modules/notifications/application/queries.ts`             |
| Tenant context lookup per request    | `src/modules/organizations/application/context.ts`             |
| Permissions per request              | `src/platform/security/authorization/permissions.ts` (`can()` does in-memory lookup) |

## 5. Query patterns observed

- Tenant isolation is enforced in **every** repository by explicit
  `where: { organizationId, … }` clauses. There is no row-level
  security in the database.
- Several pagination paths use `page * pageSize` (offset pagination).
  Cursor pagination is not yet implemented but is a candidate for
  large tables (`AuditRecord`, `SystemAuditEvent`, `Notification`).
- Notifications and audit queries use `OR` conditions on top of
  `organizationId`. The Notification table has a
  `(organizationId, userId, createdAt)` index
  (`tests/integration/data-quality.test.ts`).

## 6. Connection pool

A single Prisma client uses `pg.Pool` with `max = DATABASE_POOL_MAX`
(default 10). The pool is shared across:

- Next.js server actions and route handlers.
- The worker process (separate process, separate pool).

There is no distributed pool (PgBouncer / RDS Proxy) in the current
architecture. The trade-off is documented in
`docs/performance/connection-pool.md` (introduced in Phase 11B).

## 7. React Query configuration

- `staleTime`: 60 s
- `retry`: 1
- `refetchOnWindowFocus`: false
- `mutations.retry`: 0
- Single `QueryClient` per browser session, re-created on the server
  per request.

Source: `src/providers/QueryProvider.tsx`.

## 8. PDF generation

- Puppeteer with managed browser path (`PUPPETEER_EXECUTABLE_PATH`).
- Per-job Chromium launch (Strategy A in the Phase 11 brief).
- Browser flags: `--disable-dev-shm-usage`, optional `--no-sandbox`.
- No browser pool today; each job spawns a process.

Source: `src/platform/pdf/browser.ts`.

## 9. Background workers

- The runtime is implemented (`src/worker/runtime.ts`).
- The processor is a placeholder that throws `BACKGROUND_JOB_PROCESSOR_NOT_IMPLEMENTED`.
- The dispatcher is a synchronous placeholder (`src/platform/jobs/dispatcher.ts`).
- There is no live job store; integration points are recorded in
  `SystemAuditEvent` and `DomainEventOutbox`.

## 10. Rate limiting

- In-memory sliding window per IP / per user.
- Defined in `src/lib/rate-limit.ts`.
- Per-process state — not shared across replicas. Documented in
  `src/lib/rate-limit.ts` (the comment recommends Upstash for production).

## 11. Storage

- Adapters: `local` (dev) / `s3` (staging + production).
- Presigned URL TTL default: 900 s.
- S3 keys include tenant prefix (`organizations/{org}/...`).
- No CDN today; static assets are served by Next.js standalone.

## 12. Health checks

- `/api/health` aggregate.
- `/api/health/live` liveness.
- `/api/health/ready` readiness with db / storage / pdf checks.
- Each check has a configurable timeout (`HEALTH_CHECK_TIMEOUT_MS`).

Source: `src/platform/health/health.ts`,
`src/platform/health/default-dependencies.ts`,
`src/app/api/health/**`.

## 13. Observability

- Structured logger with `requestId`, `organizationId`, `userId`,
  `module`, `jobId`.
- `recordSecurityEvent` writes to `SystemAuditEvent` (NOT a metrics
  sink).
- No Prometheus/OTel exporter wired today. The integration point
  is the logger.

## 14. Risks observed

- `SynchronousJobDispatcher` is a placeholder — Phase 11 cannot run
  any worker load test without a real processor.
- Per-process rate limiting will skew once replicas > 1.
- Per-request `requireOrganizationContext` does 4+ DB queries
  (membership, organization, modules, permissions) — candidate for
  short-lived caching.
- `SystemAuditEvent` has no per-organization partitioning; large
  tenants will affect large scans.
- Puppeteer launches per PDF job — strategy C (worker pool) is required
  for scale.

## 15. Datasets for load testing

The Phase 11A data generator (`scripts/performance/generate-dataset.ts`)
creates three deterministic profiles — `small`, `medium`, `large`.
Sizes are documented in the brief (Section 5 of Phase 11).

## 16. Baseline run

The baseline measurements are recorded in `docs/performance/baseline.md`
after the first synthetic-dataset run. They are **never deleted** even
when later runs improve the numbers.
