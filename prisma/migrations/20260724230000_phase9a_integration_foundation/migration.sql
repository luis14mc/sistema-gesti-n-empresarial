-- Phase 9A: integration foundation.
-- Adds the OrganizationIntegration and IntegrationExecution models, the
-- IntegrationStatus / IntegrationCapability / IntegrationExecutionStatus
-- enums, and the required indices. No provider SDK is added in 9A — the
-- generic HTTP client, secret-reference abstraction, registry, retry
-- policy and circuit breaker are introduced in code only.

CREATE TYPE "IntegrationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEGRADED', 'DISABLED', 'ERROR');
CREATE TYPE "IntegrationCapability" AS ENUM (
  'IDENTITY_LOGIN',
  'USER_DIRECTORY_READ',
  'EMAIL_SEND',
  'CALENDAR_READ',
  'CALENDAR_WRITE',
  'TEAMS_NOTIFICATION',
  'SHAREPOINT_FILE_READ',
  'SHAREPOINT_FILE_WRITE',
  'OBJECT_STORAGE',
  'WEBHOOK_SEND',
  'WEBHOOK_RECEIVE',
  'ELECTRONIC_SIGNATURE'
);
CREATE TYPE "IntegrationExecutionStatus" AS ENUM (
  'STARTED',
  'SUCCESS',
  'TRANSIENT_FAILURE',
  'PERMANENT_FAILURE',
  'CIRCUIT_OPEN',
  'CANCELLED'
);

CREATE TABLE "organization_integrations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'DRAFT',
  "capabilities" "IntegrationCapability"[] NOT NULL DEFAULT ARRAY[]::"IntegrationCapability"[],
  "publicConfig" JSONB,
  "secretReference" TEXT,
  "lastTestedAt" TIMESTAMP(3),
  "lastSuccessfulAt" TIMESTAMP(3),
  "lastFailureAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_executions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "status" "IntegrationExecutionStatus" NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "requestId" TEXT,
  "correlationId" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "durationMs" INTEGER,
  "providerStatusCode" INTEGER,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "integration_executions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_executions_attempt_check" CHECK ("attempt" >= 1)
);

CREATE UNIQUE INDEX "organization_integrations_organizationId_provider_name_key"
  ON "organization_integrations"("organizationId", "provider", "name");

CREATE INDEX "organization_integrations_organizationId_status_idx"
  ON "organization_integrations"("organizationId", "status");

CREATE INDEX "organization_integrations_provider_status_idx"
  ON "organization_integrations"("provider", "status");

CREATE INDEX "integration_executions_organizationId_integrationId_startedAt_idx"
  ON "integration_executions"("organizationId", "integrationId", "startedAt" DESC);

CREATE INDEX "integration_executions_status_startedAt_idx"
  ON "integration_executions"("status", "startedAt" DESC);

CREATE INDEX "integration_executions_integrationId_startedAt_idx"
  ON "integration_executions"("integrationId", "startedAt" DESC);

ALTER TABLE "organization_integrations"
  ADD CONSTRAINT "organization_integrations_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "integration_executions"
  ADD CONSTRAINT "integration_executions_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "organization_integrations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
