-- Phase 13 · Part 1 — Equipment assignment integrity.
--
-- Invariant: ONE EQUIPMENT ITEM MAY HAVE AT MOST ONE ACTIVE ASSIGNMENT.
-- "Active" is represented by `equipment_assignments.status = 'ACTIVE'`
-- (the AssignmentStatus enum; return/replace move it to RETURNED/REPLACED).
--
-- This is the database-level concurrency guard that backstops the existing
-- application-level pre-check, which cannot prevent two concurrent requests
-- from both creating an ACTIVE row under READ COMMITTED.
--
-- Prisma cannot express a PARTIAL unique index, so this is a reviewed raw-SQL
-- migration (never `prisma db push`). Applied via `prisma migrate deploy`.

-- Safety guard: refuse to create the unique index if the data already violates
-- the invariant. Do NOT auto-pick a winner or delete rows — integrity
-- violations must be reconciled explicitly first
-- (see scripts/remediation/detect-duplicate-active-assignments.sql).
DO $$
DECLARE
  dup_equipment integer;
BEGIN
  SELECT COUNT(*) INTO dup_equipment
  FROM (
    SELECT "equipmentId"
    FROM "equipment_assignments"
    WHERE "status" = 'ACTIVE'
    GROUP BY "equipmentId"
    HAVING COUNT(*) > 1
  ) d;

  IF dup_equipment > 0 THEN
    RAISE EXCEPTION
      'REFUSED: % equipment item(s) already have more than one ACTIVE assignment. Resolve these integrity violations before applying the unique index (scripts/remediation/detect-duplicate-active-assignments.sql).',
      dup_equipment;
  END IF;
END $$;

-- One ACTIVE assignment per equipment item. Equipment belongs to exactly one
-- organization, so equipmentId alone is sufficient — organizationId is NOT
-- required in the key.
CREATE UNIQUE INDEX "equipment_assignments_one_active_per_equipment"
  ON "equipment_assignments" ("equipmentId")
  WHERE "status" = 'ACTIVE';
