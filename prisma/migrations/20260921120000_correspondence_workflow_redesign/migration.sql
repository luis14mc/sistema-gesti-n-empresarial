-- Correspondence workflow redesign: numbering config, signers, linkage, document kinds

-- Extend OficioStatus with institutional workflow values (additive only)
ALTER TYPE "OficioStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE "OficioStatus" ADD VALUE IF NOT EXISTS 'PENDING_SIGNATURE';
ALTER TYPE "OficioStatus" ADD VALUE IF NOT EXISTS 'SIGNED';
ALTER TYPE "OficioStatus" ADD VALUE IF NOT EXISTS 'ACKNOWLEDGED';
ALTER TYPE "OficioStatus" ADD VALUE IF NOT EXISTS 'RESPONDED';

-- Extend OficioTrackingAction
ALTER TYPE "OficioTrackingAction" ADD VALUE IF NOT EXISTS 'NUMBER_GENERATED';
ALTER TYPE "OficioTrackingAction" ADD VALUE IF NOT EXISTS 'RELATIONSHIP_LINKED';
ALTER TYPE "OficioTrackingAction" ADD VALUE IF NOT EXISTS 'RELATIONSHIP_UNLINKED';
ALTER TYPE "OficioTrackingAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_REMOVED';

-- Oficio core field expansion (non-destructive)
ALTER TABLE "oficios"
  ADD COLUMN IF NOT EXISTS "documentKind" TEXT NOT NULL DEFAULT 'OFICIO',
  ADD COLUMN IF NOT EXISTS "updatedById" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sequenceYear" INTEGER,
  ADD COLUMN IF NOT EXISTS "senderName" TEXT,
  ADD COLUMN IF NOT EXISTS "senderPosition" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientName" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientPosition" TEXT,
  ADD COLUMN IF NOT EXISTS "cc" TEXT,
  ADD COLUMN IF NOT EXISTS "responseToId" TEXT,
  ADD COLUMN IF NOT EXISTS "signerId" TEXT,
  ADD COLUMN IF NOT EXISTS "responsibleEmployeeId" TEXT;

-- Numbering configuration
CREATE TABLE "oficio_numbering_configs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "dependency" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "nomenclaturePattern" TEXT NOT NULL,
  "lastGeneratedSequence" INTEGER NOT NULL DEFAULT 0,
  "prefix" TEXT,
  "sequencePadding" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "oficio_numbering_configs_pkey" PRIMARY KEY ("id")
);

-- Signers catalog
CREATE TABLE "oficio_signers" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "positionTitle" TEXT NOT NULL,
  "dependency" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "oficio_signers_pkey" PRIMARY KEY ("id")
);

-- FKs for numbering configs
ALTER TABLE "oficio_numbering_configs"
  ADD CONSTRAINT "oficio_numbering_configs_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "oficio_numbering_configs"
  ADD CONSTRAINT "oficio_numbering_configs_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "oficio_numbering_configs"
  ADD CONSTRAINT "oficio_numbering_configs_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FKs for signers
ALTER TABLE "oficio_signers"
  ADD CONSTRAINT "oficio_signers_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "oficio_signers"
  ADD CONSTRAINT "oficio_signers_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FKs for oficio new columns
ALTER TABLE "oficios"
  ADD CONSTRAINT "oficios_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "oficios"
  ADD CONSTRAINT "oficios_responseToId_fkey"
  FOREIGN KEY ("responseToId") REFERENCES "oficios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "oficios"
  ADD CONSTRAINT "oficios_signerId_fkey"
  FOREIGN KEY ("signerId") REFERENCES "oficio_signers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "oficios"
  ADD CONSTRAINT "oficios_responsibleEmployeeId_fkey"
  FOREIGN KEY ("responsibleEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unique constraints / indexes
CREATE UNIQUE INDEX IF NOT EXISTS "oficio_numbering_configs_organizationId_dependency_year_key"
  ON "oficio_numbering_configs"("organizationId", "dependency", "year");

CREATE INDEX IF NOT EXISTS "oficio_numbering_configs_organizationId_isActive_idx"
  ON "oficio_numbering_configs"("organizationId", "isActive");

CREATE INDEX IF NOT EXISTS "oficio_numbering_configs_organizationId_dependency_idx"
  ON "oficio_numbering_configs"("organizationId", "dependency");

CREATE INDEX IF NOT EXISTS "oficio_signers_organizationId_isActive_idx"
  ON "oficio_signers"("organizationId", "isActive");

CREATE INDEX IF NOT EXISTS "oficio_signers_organizationId_dependency_idx"
  ON "oficio_signers"("organizationId", "dependency");

CREATE INDEX IF NOT EXISTS "oficios_documentKind_idx" ON "oficios"("documentKind");
CREATE INDEX IF NOT EXISTS "oficios_organizationId_scope_type_idx" ON "oficios"("organizationId", "scope", "type");
CREATE INDEX IF NOT EXISTS "oficios_responseToId_idx" ON "oficios"("responseToId");
CREATE INDEX IF NOT EXISTS "oficios_signerId_idx" ON "oficios"("signerId");
CREATE INDEX IF NOT EXISTS "oficios_responsibleEmployeeId_idx" ON "oficios"("responsibleEmployeeId");

-- Partial unique: outgoing document numbers per org + dependency + year
CREATE UNIQUE INDEX IF NOT EXISTS "oficios_outgoing_number_uq"
  ON "oficios"("organizationId", "scope", "sequenceYear", "number")
  WHERE "type" IN ('OUTGOING', 'INTERNAL_MEMO') AND "sequenceYear" IS NOT NULL AND "scope" IS NOT NULL;

-- Backfill sequenceYear for existing outgoing/memo records from oficioDate
UPDATE "oficios"
SET "sequenceYear" = EXTRACT(YEAR FROM "oficioDate")::INTEGER
WHERE "type" IN ('OUTGOING', 'INTERNAL_MEMO')
  AND "sequenceYear" IS NULL;

-- Seed default numbering configs from highest used sequences (best-effort)
-- CNI: prefer parsing numbers matching CNI-{n}-{year} or legacy {n}-CNI-{year}
INSERT INTO "oficio_numbering_configs" (
  "id", "organizationId", "dependency", "year", "nomenclaturePattern",
  "lastGeneratedSequence", "prefix", "sequencePadding", "notes", "isActive",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  o."organizationId",
  'CNI',
  COALESCE(o."sequenceYear", EXTRACT(YEAR FROM o."oficioDate")::INTEGER),
  'CNI-{NUMERO}-{AÑO}',
  COALESCE(MAX(
    CASE
      WHEN o."number" ~ '^CNI-[0-9]+-[0-9]{4}$' THEN CAST(split_part(o."number", '-', 2) AS INTEGER)
      WHEN o."number" ~ '^[0-9]+-CNI-[0-9]{4}$' THEN CAST(split_part(o."number", '-', 1) AS INTEGER)
      ELSE 0
    END
  ), 0),
  'CNI',
  0,
  'Migrado automáticamente desde oficios existentes',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "oficios" o
WHERE o."scope" = 'CNI' AND o."type" = 'OUTGOING'
GROUP BY o."organizationId", COALESCE(o."sequenceYear", EXTRACT(YEAR FROM o."oficioDate")::INTEGER)
ON CONFLICT ("organizationId", "dependency", "year") DO NOTHING;

INSERT INTO "oficio_numbering_configs" (
  "id", "organizationId", "dependency", "year", "nomenclaturePattern",
  "lastGeneratedSequence", "prefix", "sequencePadding", "notes", "isActive",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  o."organizationId",
  'DESPACHO',
  COALESCE(o."sequenceYear", EXTRACT(YEAR FROM o."oficioDate")::INTEGER),
  'DPICP-{NUMERO}-{AÑO}',
  COALESCE(MAX(
    CASE
      WHEN o."number" ~ '^DPICP-[0-9]+-[0-9]{4}$' THEN CAST(split_part(o."number", '-', 2) AS INTEGER)
      ELSE 0
    END
  ), 0),
  'DPICP',
  0,
  'Migrado automáticamente desde oficios existentes',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "oficios" o
WHERE (o."scope" = 'DESPACHO' OR o."number" LIKE 'DPICP-%') AND o."type" = 'OUTGOING'
GROUP BY o."organizationId", COALESCE(o."sequenceYear", EXTRACT(YEAR FROM o."oficioDate")::INTEGER)
ON CONFLICT ("organizationId", "dependency", "year") DO NOTHING;

INSERT INTO "oficio_numbering_configs" (
  "id", "organizationId", "dependency", "year", "nomenclaturePattern",
  "lastGeneratedSequence", "prefix", "sequencePadding", "notes", "isActive",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  o."organizationId",
  'INTERNO',
  COALESCE(o."sequenceYear", EXTRACT(YEAR FROM o."oficioDate")::INTEGER),
  'MEMO-{NUMERO}-{AÑO}',
  COALESCE(MAX(
    CASE
      WHEN o."number" ~ '^MEMO-[0-9]+-[0-9]{4}$' THEN CAST(split_part(o."number", '-', 2) AS INTEGER)
      ELSE 0
    END
  ), 0),
  'MEMO',
  0,
  'Migrado automáticamente desde memos existentes',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "oficios" o
WHERE (o."scope" = 'INTERNO' OR o."type" = 'INTERNAL_MEMO')
GROUP BY o."organizationId", COALESCE(o."sequenceYear", EXTRACT(YEAR FROM o."oficioDate")::INTEGER)
ON CONFLICT ("organizationId", "dependency", "year") DO NOTHING;
