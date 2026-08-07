-- Phase S1 · Employee tenant isolation.
--
-- Closes C-5 (CRITICAL IDOR): employees had no `organizationId` and the API
-- endpoints returned / mutated rows from any organization. We add the column,
-- backfill from the linked User's active membership, and enforce NOT NULL
-- + FK + unique (organizationId, email) so the same email can exist in
-- multiple tenants without violating the global unique constraint.
--
-- Prisma cannot express a conditional / partial unique index, and we need
-- to keep `email` globally unique while allowing the same email across
-- tenants (legacy `email` unique index is replaced by `(organizationId, email)`).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "organizations" WHERE "slug" = 'cni' AND "status" = 'ACTIVE') THEN
    RAISE EXCEPTION 'Active CNI organization (slug=cni) is required before employee backfill';
  END IF;
END $$;

-- Step 1: add nullable column.
ALTER TABLE "employees" ADD COLUMN "organizationId" TEXT;

-- Step 2: backfill from User.memberships (active first by createdAt asc).
UPDATE "employees" e
SET "organizationId" = (
  SELECT om."organizationId"
  FROM "organization_memberships" om
  WHERE om."userId" = e."userId"
    AND om."status" = 'ACTIVE'
  ORDER BY om."createdAt" ASC
  LIMIT 1
)
WHERE e."userId" IS NOT NULL
  AND e."organizationId" IS NULL;

-- Step 3: any employee still missing organizationId (orphaned records without a User)
-- falls back to the default CNI tenant. There should be none in production,
-- but the safety net prevents the NOT NULL constraint from failing.
UPDATE "employees"
SET "organizationId" = (SELECT "id" FROM "organizations" WHERE "slug" = 'cni')
WHERE "organizationId" IS NULL;

-- Step 4: data-integrity guard — refuse to apply NOT NULL if there are still
-- orphans (i.e. the previous UPDATE didn't reach them because the CNI org
-- doesn't exist for some reason).
DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count FROM "employees" WHERE "organizationId" IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'REFUSED: % employee(s) still have NULL organizationId after backfill', missing_count;
  END IF;
END $$;

-- Step 5: FK constraint.
ALTER TABLE "employees"
  ADD CONSTRAINT "employees_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- Step 6: NOT NULL.
ALTER TABLE "employees" ALTER COLUMN "organizationId" SET NOT NULL;

-- Step 7: index for tenant-scoped queries.
CREATE INDEX "employees_organizationId_isActive_idx"
  ON "employees"("organizationId", "isActive");

-- Step 8: replace global `email` unique with tenant-scoped unique.
-- The legacy `employees_email_key` index will be dropped in the same migration.
DROP INDEX IF EXISTS "employees_email_key";
CREATE UNIQUE INDEX "employees_organizationId_email_key"
  ON "employees"("organizationId", "email");

-- Step 9: same for `employeeCode` (was globally unique).
DROP INDEX IF EXISTS "employees_employeeCode_key";
CREATE UNIQUE INDEX "employees_organizationId_employeeCode_key"
  ON "employees"("organizationId", "employeeCode")
  WHERE "employeeCode" IS NOT NULL;
