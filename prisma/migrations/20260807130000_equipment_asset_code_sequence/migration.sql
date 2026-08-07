-- Phase S4 Equipment · Atomic per-organization asset code generation.
--
-- Closes A-1 (HIGH race condition): `generateAssetCode` previously scanned
-- inventory codes globally across all organizations and computed the next
-- number non-atomically, allowing two concurrent POSTs to assign the same
-- code (one would then collide on the unique index and return 409 to the user).
--
-- This migration adds EQUIPMENT_ASSET_CODE to the DocumentType enum and
-- reuses the existing `document_sequences` table (one row per
-- (organizationId, documentType, year)) for atomic increment via
-- `allocateDocumentSequence` in src/platform/sequences/document-sequence.ts.

-- Step 1: add new enum value (PostgreSQL allows adding values without rewriting the table).
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'EQUIPMENT_ASSET_CODE';

-- Step 2: backfill — for each organization that already has equipment, seed a
-- row in document_sequences with the current max inventoryCode per category
-- so the first generated code after migration doesn't collide with existing data.
-- We aggregate per (organizationId, category-prefix) using a single query per org.

DO $$
DECLARE
  rec RECORD;
  max_num INTEGER;
  seq_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
BEGIN
  FOR rec IN
    SELECT "organizationId",
           substring("inventoryCode" from '^TI-([A-Z]+)-') AS cat_prefix,
           MAX(
             COALESCE(
               substring("inventoryCode" from '[0-9]+$')::INTEGER,
               0
             )
           ) AS max_n
    FROM "equipment"
    WHERE "inventoryCode" ~ '^TI-[A-Z]+-[0-9]+$'
    GROUP BY "organizationId", cat_prefix
  LOOP
    max_num := rec.max_n;
    IF max_num IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO "document_sequences" ("id", "organizationId", "documentType", "year", "lastValue", "updatedAt")
    VALUES (
      gen_random_uuid()::text,
      rec."organizationId",
      'EQUIPMENT_ASSET_CODE',
      seq_year,
      max_num,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("organizationId", "documentType", "year") DO UPDATE
      SET "lastValue" = GREATEST("document_sequences"."lastValue", EXCLUDED."lastValue");
  END LOOP;
END $$;
