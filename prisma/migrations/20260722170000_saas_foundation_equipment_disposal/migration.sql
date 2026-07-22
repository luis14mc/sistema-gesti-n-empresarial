-- Additive SaaS foundation. Existing domain ownership remains nullable until all
-- legacy repositories enforce organization scope in a later migration.
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'IT_MANAGER', 'IT_TECHNICIAN', 'PROCUREMENT', 'HR', 'AUDITOR', 'USER');
CREATE TYPE "DocumentType" AS ENUM ('EQUIPMENT_DISPOSAL', 'PURCHASE_ORDER', 'OFFICE_DOCUMENT');
CREATE TYPE "PhysicalCondition" AS ENUM ('EXCELLENT', 'ACCEPTABLE', 'FAIR', 'POOR', 'CRITICAL');
CREATE TYPE "FunctionalCondition" AS ENUM ('OPERATIONAL', 'SLOW', 'FREQUENT_FAILURES', 'INOPERABLE');
CREATE TYPE "SecuritySupportStatus" AS ENUM ('SUPPORTED', 'LIMITED_SUPPORT', 'UNSUPPORTED', 'VULNERABLE');
CREATE TYPE "DisposalStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "DisposalResult" AS ENUM ('DISPOSAL_JUSTIFIED', 'EVALUATION_REQUIRED', 'KEEP_IN_SERVICE');
CREATE TYPE "DisposalHistoryAction" AS ENUM ('DISPOSAL_CREATED', 'DISPOSAL_UPDATED', 'DISPOSAL_SUBMITTED', 'DISPOSAL_APPROVED', 'DISPOSAL_REJECTED', 'DISPOSAL_CANCELLED', 'DISPOSAL_DOCUMENT_UPLOADED', 'DISPOSAL_DOCUMENT_DELETED', 'DISPOSAL_PDF_GENERATED', 'EQUIPMENT_STATUS_CHANGED');
CREATE TYPE "ReplacementProjectionStatus" AS ENUM ('PENDING', 'CONVERTED', 'CANCELLED');

ALTER TYPE "EquipmentStatus" ADD VALUE IF NOT EXISTS 'DISPOSAL_IN_PROGRESS';
ALTER TYPE "EquipmentStatus" ADD VALUE IF NOT EXISTS 'DISPOSED';

CREATE TABLE "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "legalName" TEXT,
  "rtn" TEXT,
  "logoKey" TEXT,
  "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

INSERT INTO "organizations" ("id", "name", "slug", "legalName", "status", "updatedAt")
VALUES ('org_cni_default', 'Consejo Nacional de Inversiones', 'cni', 'Consejo Nacional de Inversiones', 'ACTIVE', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

CREATE TABLE "organization_memberships" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "OrganizationRole" NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "organization_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "organization_memberships_organizationId_userId_key" ON "organization_memberships"("organizationId", "userId");
CREATE INDEX "organization_memberships_userId_idx" ON "organization_memberships"("userId");
CREATE INDEX "organization_memberships_organizationId_role_idx" ON "organization_memberships"("organizationId", "role");

INSERT INTO "organization_memberships" ("id", "organizationId", "userId", "role", "status", "updatedAt")
SELECT 'membership_cni_' || "id", 'org_cni_default', "id",
  CASE "role"::text
    WHEN 'ADMIN' THEN 'ADMIN'::"OrganizationRole"
    WHEN 'IT' THEN 'IT_TECHNICIAN'::"OrganizationRole"
    WHEN 'RRHH' THEN 'HR'::"OrganizationRole"
    ELSE 'USER'::"OrganizationRole"
  END,
  'ACTIVE', CURRENT_TIMESTAMP
FROM "users"
ON CONFLICT ("organizationId", "userId") DO NOTHING;

ALTER TABLE "equipment" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "equipment_assignments" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "tickets" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "audit_records"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "entityType" TEXT,
  ADD COLUMN "action" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "requestId" TEXT;

UPDATE "equipment" SET "organizationId" = 'org_cni_default' WHERE "organizationId" IS NULL;
UPDATE "purchase_orders" SET "organizationId" = 'org_cni_default' WHERE "organizationId" IS NULL;
UPDATE "equipment_assignments" SET "organizationId" = 'org_cni_default' WHERE "organizationId" IS NULL;
UPDATE "tickets" SET "organizationId" = 'org_cni_default' WHERE "organizationId" IS NULL;
UPDATE "audit_records" SET "organizationId" = 'org_cni_default' WHERE "organizationId" IS NULL;

ALTER TABLE "equipment" ADD CONSTRAINT "equipment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_records" ADD CONSTRAINT "audit_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT;
CREATE INDEX "equipment_organizationId_status_idx" ON "equipment"("organizationId", "status");
CREATE INDEX "purchase_orders_organizationId_status_idx" ON "purchase_orders"("organizationId", "status");
CREATE INDEX "audit_records_organizationId_createdAt_idx" ON "audit_records"("organizationId", "createdAt");
CREATE INDEX "audit_records_organizationId_entityType_entityId_idx" ON "audit_records"("organizationId", "entityType", "entityId");
CREATE INDEX "equipment_assignments_organizationId_status_idx" ON "equipment_assignments"("organizationId", "status");
CREATE INDEX "tickets_organizationId_status_idx" ON "tickets"("organizationId", "status");

CREATE TABLE "document_sequences" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "documentType" "DocumentType" NOT NULL,
  "year" INTEGER NOT NULL,
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_sequences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "document_sequences_organizationId_documentType_year_key" ON "document_sequences"("organizationId", "documentType", "year");
CREATE INDEX "document_sequences_organizationId_year_idx" ON "document_sequences"("organizationId", "year");

CREATE TABLE "disposal_policies" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "maxAgeYears" DECIMAL(5,2) NOT NULL DEFAULT 5,
  "repairThresholdPct" DECIMAL(5,2) NOT NULL DEFAULT 50,
  "ageWeight" INTEGER NOT NULL DEFAULT 25,
  "repairWeight" INTEGER NOT NULL DEFAULT 30,
  "conditionWeight" INTEGER NOT NULL DEFAULT 30,
  "securityWeight" INTEGER NOT NULL DEFAULT 15,
  "approvalScoreThreshold" INTEGER NOT NULL DEFAULT 60,
  "reviewScoreThreshold" INTEGER NOT NULL DEFAULT 35,
  "folioPrefix" TEXT NOT NULL DEFAULT 'DICT-BAJA',
  "footerText" TEXT,
  "signatureTitle" TEXT NOT NULL DEFAULT 'APROBACIÓN INSTITUCIONAL',
  "approverRoles" "OrganizationRole"[] NOT NULL DEFAULT ARRAY['OWNER', 'ADMIN', 'IT_MANAGER']::"OrganizationRole"[],
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "disposal_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "disposal_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "disposal_policy_weights_check" CHECK ("ageWeight" >= 0 AND "repairWeight" >= 0 AND "conditionWeight" >= 0 AND "securityWeight" >= 0 AND "ageWeight" + "repairWeight" + "conditionWeight" + "securityWeight" = 100),
  CONSTRAINT "disposal_policy_thresholds_check" CHECK ("approvalScoreThreshold" BETWEEN 0 AND 100 AND "reviewScoreThreshold" BETWEEN 0 AND 100 AND "repairThresholdPct" > 0 AND "repairThresholdPct" <= 100)
);
CREATE UNIQUE INDEX "disposal_policies_organizationId_key" ON "disposal_policies"("organizationId");
INSERT INTO "disposal_policies" ("id", "organizationId", "updatedAt")
VALUES ('policy_cni_default', 'org_cni_default', CURRENT_TIMESTAMP)
ON CONFLICT ("organizationId") DO NOTHING;

CREATE TABLE "equipment_disposals" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "folio" TEXT NOT NULL, "equipmentId" TEXT NOT NULL,
  "previousEquipmentStatus" "EquipmentStatus" NOT NULL, "serialNumber" TEXT NOT NULL, "category" TEXT NOT NULL,
  "brand" TEXT NOT NULL, "model" TEXT NOT NULL, "department" TEXT NOT NULL, "custodianName" TEXT,
  "purchaseDate" DATE NOT NULL, "purchasePrice" DECIMAL(14,2) NOT NULL, "estimatedRepairCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "estimatedReplacementPrice" DECIMAL(14,2) NOT NULL, "physicalCondition" "PhysicalCondition" NOT NULL,
  "functionalCondition" "FunctionalCondition" NOT NULL, "securitySupportStatus" "SecuritySupportStatus" NOT NULL,
  "technicalNotes" TEXT, "evaluationScore" INTEGER NOT NULL, "disposalResult" "DisposalResult" NOT NULL,
  "evaluationRationales" JSONB, "status" "DisposalStatus" NOT NULL DEFAULT 'DRAFT', "evaluatedById" TEXT NOT NULL,
  "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "submittedAt" TIMESTAMP(3), "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT, "cancelledAt" TIMESTAMP(3), "cancellationReason" TEXT, "pdfStorageKey" TEXT,
  "templateSnapshot" JSONB, "dataSnapshot" JSONB, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "equipment_disposals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "equipment_disposals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "equipment_disposals_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT,
  CONSTRAINT "equipment_disposals_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "equipment_disposals_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "equipment_disposals_organizationId_folio_key" ON "equipment_disposals"("organizationId", "folio");
CREATE INDEX "equipment_disposals_organizationId_status_idx" ON "equipment_disposals"("organizationId", "status");
CREATE INDEX "equipment_disposals_organizationId_equipmentId_idx" ON "equipment_disposals"("organizationId", "equipmentId");
CREATE INDEX "equipment_disposals_organizationId_createdAt_idx" ON "equipment_disposals"("organizationId", "createdAt");
CREATE INDEX "equipment_disposals_organizationId_disposalResult_idx" ON "equipment_disposals"("organizationId", "disposalResult");
CREATE INDEX "equipment_disposals_organizationId_evaluatedById_idx" ON "equipment_disposals"("organizationId", "evaluatedById");

CREATE TABLE "disposal_documents" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "disposalId" TEXT NOT NULL, "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL, "originalName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "fileSize" INTEGER NOT NULL,
  "fileHash" TEXT, "uploadedById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "disposal_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "disposal_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "disposal_documents_disposalId_fkey" FOREIGN KEY ("disposalId") REFERENCES "equipment_disposals"("id") ON DELETE CASCADE,
  CONSTRAINT "disposal_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX "disposal_documents_organizationId_disposalId_idx" ON "disposal_documents"("organizationId", "disposalId");
CREATE INDEX "disposal_documents_organizationId_fileHash_idx" ON "disposal_documents"("organizationId", "fileHash");

CREATE TABLE "equipment_disposal_history" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "disposalId" TEXT NOT NULL, "action" "DisposalHistoryAction" NOT NULL,
  "previousValues" JSONB, "newValues" JSONB, "metadata" JSONB, "requestId" TEXT, "performedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "equipment_disposal_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "equipment_disposal_history_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "equipment_disposal_history_disposalId_fkey" FOREIGN KEY ("disposalId") REFERENCES "equipment_disposals"("id") ON DELETE CASCADE,
  CONSTRAINT "equipment_disposal_history_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX "equipment_disposal_history_organizationId_disposalId_createdAt_idx" ON "equipment_disposal_history"("organizationId", "disposalId", "createdAt");

CREATE TABLE "replacement_projections" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "disposalId" TEXT NOT NULL, "equipmentId" TEXT NOT NULL,
  "estimatedAmount" DECIMAL(14,2) NOT NULL, "status" "ReplacementProjectionStatus" NOT NULL DEFAULT 'PENDING',
  "purchaseOrderId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "replacement_projections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "replacement_projections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "replacement_projections_disposalId_fkey" FOREIGN KEY ("disposalId") REFERENCES "equipment_disposals"("id") ON DELETE RESTRICT,
  CONSTRAINT "replacement_projections_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT,
  CONSTRAINT "replacement_projections_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "replacement_projections_disposalId_key" ON "replacement_projections"("disposalId");
CREATE INDEX "replacement_projections_organizationId_status_idx" ON "replacement_projections"("organizationId", "status");
CREATE INDEX "replacement_projections_organizationId_equipmentId_idx" ON "replacement_projections"("organizationId", "equipmentId");
