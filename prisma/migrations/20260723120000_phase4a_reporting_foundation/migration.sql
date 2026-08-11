-- Phase 4A: trusted reporting timezone and auditable report executions.
ALTER TABLE "organizations"
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Tegucigalpa';

CREATE TYPE "ReportExecutionStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "report_executions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reportCode" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "rowCount" INTEGER,
  "status" "ReportExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "storageKey" TEXT,
  "durationMs" INTEGER,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "report_executions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "report_executions_organizationId_userId_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "organization_memberships"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "report_executions_rowCount_check" CHECK ("rowCount" IS NULL OR "rowCount" >= 0),
  CONSTRAINT "report_executions_durationMs_check" CHECK ("durationMs" IS NULL OR "durationMs" >= 0)
);

CREATE INDEX "report_executions_organizationId_reportCode_createdAt_idx"
ON "report_executions"("organizationId", "reportCode", "createdAt");

CREATE INDEX "report_executions_organizationId_userId_createdAt_idx"
ON "report_executions"("organizationId", "userId", "createdAt");
