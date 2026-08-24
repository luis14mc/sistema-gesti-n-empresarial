-- P0 navigation/action hotfix: synchronize the canonical purchase-order
-- sequence with existing tenant-scoped orders before new drafts are created.
INSERT INTO "document_sequences" ("id", "organizationId", "documentType", "year", "lastValue", "updatedAt")
SELECT
  gen_random_uuid()::text,
  "organizationId",
  'PURCHASE_ORDER'::"DocumentType",
  "sequenceYear",
  MAX("sequenceNumber"),
  CURRENT_TIMESTAMP
FROM "purchase_orders"
WHERE "sequenceYear" IS NOT NULL
  AND "sequenceNumber" IS NOT NULL
GROUP BY "organizationId", "sequenceYear"
ON CONFLICT ("organizationId", "documentType", "year") DO UPDATE
SET "lastValue" = GREATEST("document_sequences"."lastValue", EXCLUDED."lastValue"),
    "updatedAt" = CURRENT_TIMESTAMP;
