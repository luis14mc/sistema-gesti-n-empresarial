-- Phase 6A: separate platform identity and strengthen immutable security events.
CREATE TYPE "PlatformRole" AS ENUM ('PLATFORM_ADMIN', 'SUPPORT_ADMIN');
CREATE TYPE "SecurityEventOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');
CREATE TYPE "SecurityEventSeverity" AS ENUM ('INFO', 'NOTICE', 'WARNING', 'CRITICAL');

ALTER TABLE "users" ADD COLUMN "platformRole" "PlatformRole";
CREATE INDEX "users_platformRole_idx" ON "users"("platformRole");

ALTER TABLE "system_audit_events"
  ALTER COLUMN "organizationId" DROP NOT NULL,
  ALTER COLUMN "entityId" DROP NOT NULL,
  ADD COLUMN "eventType" TEXT NOT NULL DEFAULT 'legacy.event.recorded',
  ADD COLUMN "outcome" "SecurityEventOutcome" NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN "severity" "SecurityEventSeverity" NOT NULL DEFAULT 'INFO',
  ADD COLUMN "reasonCode" TEXT,
  ADD COLUMN "attributes" JSONB,
  ADD COLUMN "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "system_audit_events"
  ADD CONSTRAINT "system_audit_events_schemaVersion_check" CHECK ("schemaVersion" > 0);

CREATE INDEX "system_audit_events_eventType_occurredAt_idx"
  ON "system_audit_events"("eventType", "occurredAt");
CREATE INDEX "system_audit_events_outcome_occurredAt_idx"
  ON "system_audit_events"("outcome", "occurredAt");

CREATE TRIGGER "system_audit_events_no_truncate"
BEFORE TRUNCATE ON "system_audit_events"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_system_audit_event_mutation();
