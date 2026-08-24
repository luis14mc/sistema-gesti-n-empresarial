-- Backfill sequence rows after EQUIPMENT_ASSET_CODE has been committed.
DO $$
DECLARE
  rec RECORD;
  max_num INTEGER;
  seq_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
BEGIN
  FOR rec IN
    SELECT "organizationId",
           substring("inventoryCode" from '^TI-([A-Z]+)-') AS cat_prefix,
           MAX(COALESCE(substring("inventoryCode" from '[0-9]+$')::INTEGER, 0)) AS max_n
    FROM "equipment"
    WHERE "inventoryCode" ~ '^TI-[A-Z]+-[0-9]+$'
    GROUP BY "organizationId", cat_prefix
  LOOP
    max_num := rec.max_n;
    IF max_num IS NULL THEN CONTINUE; END IF;

    INSERT INTO "document_sequences" ("id", "organizationId", "documentType", "year", "lastValue", "updatedAt")
    VALUES (gen_random_uuid()::text, rec."organizationId", 'EQUIPMENT_ASSET_CODE', seq_year, max_num, CURRENT_TIMESTAMP)
    ON CONFLICT ("organizationId", "documentType", "year") DO UPDATE
      SET "lastValue" = GREATEST("document_sequences"."lastValue", EXCLUDED."lastValue");
  END LOOP;
END $$;
