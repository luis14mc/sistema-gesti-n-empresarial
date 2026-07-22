# Organization migration plan

This runbook covers the staged rollout of the organization foundation introduced by `20260722170000_saas_foundation_equipment_disposal`. The database is PostgreSQL and production migrations are applied with Prisma Migrate.

## Current state

The foundation migration is additive. It creates organizations, memberships, organization roles, tenant-owned equipment-disposal tables, document sequences, and the default CNI tenant. It also adds nullable `organizationId` foreign keys and indexes to:

- `equipment`
- `purchase_orders` (Prisma model `CompraOrden`)
- `audit_records`

The migration updates existing rows in those three tables to `org_cni_default`, but the columns intentionally remain nullable. This permits old application versions and legacy repositories to coexist during a rolling deployment. It also means database constraints do not yet guarantee tenant ownership for new legacy-domain rows.

## CNI bootstrap

The migration bootstraps the organization with ID `org_cni_default`, slug `cni`, and name `Consejo Nacional de Inversiones`. It creates a default disposal policy and maps every existing user into an active membership:

| Legacy role | CNI organization role |
| --- | --- |
| `ADMIN` | `ADMIN` |
| `IT` | `IT_TECHNICIAN` |
| `RRHH` | `HR` |
| `USER` or any other legacy role | `USER` |

The SQL uses conflict-safe inserts. The repository also contains an idempotent application-level backfill that upserts the same organization, memberships, missing ownership, and disposal policy:

```bash
DATABASE_URL="postgresql://..." npx tsx scripts/backfill-default-organization.ts
```

`prisma.config.ts` prefers `DIRECT_URL` over `DATABASE_URL`. Set `DIRECT_URL` for migrations when production uses a pooled runtime URL.

## Staged migration

### 1. Expand

1. Take and verify a restorable database backup.
2. Build the release artifact and run `npm run typecheck`, `npm test`, and `npm run build` against the release commit.
3. Apply the additive migration with `npm run prisma:migrate:deploy` using the direct production database connection.
4. Confirm the default organization, memberships, foreign keys, and indexes exist.

Do not make legacy ownership columns `NOT NULL` in this stage. Old and new tasks may overlap during ECS rolling deployment.

### 2. Backfill

Run the idempotent backfill after the expand migration and before enabling tenant-aware traffic:

```bash
DIRECT_URL="postgresql://..." npx tsx scripts/backfill-default-organization.ts
```

Run it again after any period in which an old application version could have inserted rows. The command only fills null ownership and does not move rows already assigned to an organization.

### 3. Verify and convert repositories

Convert each legacy repository and route to derive tenant context from an active membership and include `organizationId` in every read and write predicate. Parent/child records, sequences, audit records, exports, and storage paths must be scoped together. Deploy and observe this code while columns remain nullable.

The equipment-disposal domain and equipment API already demonstrate this pattern. Do not infer that all other legacy repositories have been converted.

### 4. Contract

Only after all production writers are tenant-aware and the preflight queries remain clean:

1. Add a new reviewed Prisma migration that makes the three legacy `organizationId` columns required.
2. Consider validating cross-table tenant consistency where a foreign key alone cannot ensure parent and child share an organization.
3. Apply the contract migration before deploying code that assumes database-level non-null guarantees.

The contract migration does not exist in the current repository and must not be improvised with `prisma db push` in production.

## Preflight

Run these checks against the deployment target before the contract stage and record the results:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations
ORDER BY started_at DESC;

SELECT id, slug, status
FROM organizations
WHERE id = 'org_cni_default' OR slug = 'cni';

SELECT COUNT(*) AS users_without_active_membership
FROM users u
WHERE NOT EXISTS (
  SELECT 1
  FROM organization_memberships m
  JOIN organizations o ON o.id = m."organizationId"
  WHERE m."userId" = u.id
    AND m.status = 'ACTIVE'
    AND o.status = 'ACTIVE'
);

SELECT
  (SELECT COUNT(*) FROM equipment WHERE "organizationId" IS NULL) AS equipment_nulls,
  (SELECT COUNT(*) FROM purchase_orders WHERE "organizationId" IS NULL) AS purchase_order_nulls,
  (SELECT COUNT(*) FROM audit_records WHERE "organizationId" IS NULL) AS audit_record_nulls;
```

All three null counts must be zero before adding `NOT NULL`. Investigate users without an active membership rather than assigning them to an arbitrary tenant if CNI is no longer the only organization.

Also run tenant-isolation tests and production smoke tests. The repository's `scripts/smoke-test.sh` is intended for post-deployment checks; it does not replace database preflight or cross-tenant authorization tests.

## Rollback

Prefer application rollback over destructive schema rollback because the foundation migration is additive and compatible with the prior application while nullable columns remain in place.

1. Stop or disable tenant-aware traffic if authorization behavior is suspect.
2. Redeploy the previous known-good image as described in `docs/runbook-aws.md`.
3. Leave additive tables, columns, enum values, and backfilled ownership in place unless a separately reviewed rollback is required.
4. Restore from the verified backup if the migration caused data corruption that cannot be corrected forward.

Prisma does not generate automatic down migrations. PostgreSQL enum additions and a migration that creates populated, related tables are not safely reversed by deleting a row from `_prisma_migrations`. Never drop organization data or remove migration history merely to make an older image start. If schema rollback is unavoidable, prepare and test explicit SQL against a restored production snapshot, account for all foreign keys and new data, then use `prisma migrate resolve` according to the actual database state.

Before a future `NOT NULL` contract migration, retain a compatible application image that tolerates both nullable and non-null ownership. Rolling back after contract should normally redeploy that compatible image; dropping `NOT NULL` is a separate forward migration if operationally necessary.

## Production deployment order

1. Freeze schema changes and create a verified backup or snapshot.
2. Run preflight, release tests, and a staging rehearsal using production-like data volume.
3. Build and push the immutable application image; do not deploy it yet.
4. Apply `npm run prisma:migrate:deploy` with `DIRECT_URL` or the direct `DATABASE_URL`.
5. Run `scripts/backfill-default-organization.ts`.
6. Re-run the membership and null-ownership preflight checks.
7. Deploy the new image through the ECS/Terraform rolling deployment.
8. Run health checks, `scripts/smoke-test.sh`, and explicit cross-tenant IDOR tests; monitor authorization failures and database errors.
9. Re-run the backfill if old tasks were able to write during rollout, then verify null counts again.
10. Schedule the separate contract migration only after every writer is tenant-aware and the observation period is clean.

The runtime Docker image includes the Prisma schema and migrations, but its command is only `next start`; it does not apply migrations automatically. Migration and backfill must therefore be explicit deployment jobs executed before the new application tasks receive traffic.

## References

- `prisma/migrations/20260722170000_saas_foundation_equipment_disposal/migration.sql`
- `scripts/backfill-default-organization.ts`
- `prisma/schema.prisma`
- `prisma.config.ts`
- `Dockerfile`
- `docs/runbook-aws.md`
- `docs/security/rbac.md`
