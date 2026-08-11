# Phase 11C — API and frontend performance

## 1. Response-size budgets

The list endpoints return the documented projection. Common budgets
(measured in the first baseline run, recorded in
`docs/performance/baseline.md`):

| Endpoint                              | Limit per page | Avg payload |
| ------------------------------------- | -------------- | ----------- |
| `GET /api/oficios`                    | 20 items       | ~6 KB        |
| `GET /api/oficios/{id}`               | 1 item         | ~5 KB        |
| `GET /api/equipment`                   | 20 items       | ~8 KB        |
| `GET /api/equipment/{id}`             | 1 item + 50 history | ~12 KB |
| `GET /api/compras/ordenes`            | 20 items       | ~10 KB       |
| `GET /api/compras/ordenes/{id}`       | 1 item + items | ~14 KB       |
| `GET /api/notifications`              | 20 items       | ~4 KB        |
| `GET /api/notifications/unread-count` | 1 number       | < 100 B       |
| `GET /api/audit-logs`                 | 50 items       | _pending_    |
| `GET /api/equipment/stats`            | aggregates      | ~3 KB        |
| `GET /api/reports/catalog`            | static catalog | ~5 KB        |
| `GET /api/health/live`                | 1 status       | < 100 B       |
| `GET /api/health/ready`               | checks map      | < 200 B       |

The equipment detail endpoint pulls up to 50 history entries. The
Phase 11C recommendation is to cap `assignments` to the latest 20
and `maintenances` to the latest 10, with a separate paginated
endpoint for the full history.

## 2. Query-count budget

Per `docs/performance/database.md` §10. The budget is enforced by
the `tests/performance/query-count.test.ts` scaffold.

## 3. React Query configuration

The current provider (`src/providers/QueryProvider.tsx`) sets:

| Setting                | Value | Note |
| ---------------------- | ----- | ---- |
| `staleTime`            | 60 s  | Cheap queries revalidate every minute. |
| `retry`                | 1     | Fails fast on persistent errors. |
| `refetchOnWindowFocus` | false | Avoids noisy refetches. |
| `mutations.retry`      | 0     | Mutations must be deliberate. |

The Phase 11C recommendation is to:

1. Make query keys include the `organizationId` so two tenants
   never share a cache entry.
2. Use longer `staleTime` for static data (organization settings,
   reference catalogs).
3. Use shorter `staleTime` for live data (notifications, dashboard).

## 4. Server/Client boundary audit

The Phase 11C rules for the Server/Client boundary:

- `'use client'` is acceptable for interactive forms, dialogs, and
  charts.
- Static presentation must remain in Server Components.
- The platform layouts (`src/app/layout.tsx`, `src/app/dashboard/layout.tsx`)
  are Server Components; the QueryProvider is the only client-side
  wrapper.

## 5. Bundle size budget

The Phase 11C initial budgets (pending next-build measurement):

| Bundle             | Limit (gzip) |
| ------------------ | ------------ |
| Dashboard initial  | 110 KB       |
| Oficios initial    | 130 KB       |
| Equipment initial  | 130 KB       |
| Compras initial    | 150 KB       |
| Reportes initial   | 150 KB       |

Puppeteer is **never** bundled into the client. Dynamic imports are
used for charts and PDF rendering libraries.

## 6. Compression

The standalone Next.js server does not enable compression by default.
The Dockerfile and the runtime configuration must enable gzip for
text responses. The Phase 11C recommendation is to:

- Enable `compress: true` on the Next.js server only for JSON /
  HTML / CSS / JS.
- Do not compress PDF / JPEG / PNG / ZIP.

## 7. CDN policy

The Phase 11C policy is:

- Public assets (`/_next/static`, logos) → CDN.
- Public organization logos (when policy allows) → CDN.
- Official documents (purchase orders, disposal dictámenes) → never
  CDN. They remain authenticated via signed URLs.

## 8. Frontend perf budgets in CI

The Phase 11C deliverables include a document-size per route
regression test. The current scaffold is
`tests/performance/bundle-budget.test.ts`. It enforces the budgets
above once the first build artifact is captured.
