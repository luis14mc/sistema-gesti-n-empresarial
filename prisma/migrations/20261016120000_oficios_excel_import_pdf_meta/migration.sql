-- Oficios import batches (tenant + undo) and PDF optimization metadata on documents.

ALTER TABLE "oficio_import_batches"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sequenceSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "totalRows" INTEGER NOT NULL DEFAULT 0;

UPDATE "oficio_import_batches" b
SET "organizationId" = u."organizationId"
FROM "users" u
WHERE b."organizationId" IS NULL
  AND b."performedById" = u."id"
  AND u."organizationId" IS NOT NULL;

UPDATE "oficio_import_batches" b
SET "organizationId" = o."organizationId"
FROM "oficio_import_batch_items" i
JOIN "oficios" o ON o."id" = i."oficioId"
WHERE b."organizationId" IS NULL
  AND i."batchId" = b."id"
  AND o."organizationId" IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oficio_import_batches_organizationId_fkey'
  ) THEN
    ALTER TABLE "oficio_import_batches"
      ADD CONSTRAINT "oficio_import_batches_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "oficio_import_batches_organizationId_startedAt_idx"
  ON "oficio_import_batches"("organizationId", "startedAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "oficio_import_batches" WHERE "organizationId" IS NULL) THEN
    ALTER TABLE "oficio_import_batches" ALTER COLUMN "organizationId" SET NOT NULL;
  END IF;
END $$;

ALTER TABLE "oficio_documents"
  ADD COLUMN IF NOT EXISTS "originalSizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "storedSizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "optimized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "signedPdf" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "purchase_order_documents"
  ADD COLUMN IF NOT EXISTS "originalSizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "storedSizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "optimized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "signedPdf" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "disposal_documents"
  ADD COLUMN IF NOT EXISTS "originalSizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "storedSizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "optimized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "signedPdf" BOOLEAN NOT NULL DEFAULT false;
