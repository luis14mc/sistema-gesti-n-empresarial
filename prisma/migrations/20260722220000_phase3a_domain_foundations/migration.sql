-- Phase 3A: additive aggregate concurrency, immutable audit events, and outbox.
ALTER TABLE "tickets" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "oficios" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "equipment" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "equipment_assignments" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "proveedores" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "audits" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "purchase_orders" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "tickets" ADD CONSTRAINT "tickets_version_check" CHECK ("version" > 0);
ALTER TABLE "oficios" ADD CONSTRAINT "oficios_version_check" CHECK ("version" > 0);
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_version_check" CHECK ("version" > 0);
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_version_check" CHECK ("version" > 0);
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_version_check" CHECK ("version" > 0);
ALTER TABLE "audits" ADD CONSTRAINT "audits_version_check" CHECK ("version" > 0);
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_version_check" CHECK ("version" > 0);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "equipment_assignments"
    WHERE "status" = 'ACTIVE'
    GROUP BY "equipmentId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate active equipment assignments must be resolved before Phase 3A';
  END IF;
END $$;

CREATE UNIQUE INDEX "equipment_assignments_one_active_per_equipment_key"
ON "equipment_assignments"("equipmentId")
WHERE "status" = 'ACTIVE';

CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

CREATE TABLE "system_audit_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "module" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "previousData" JSONB,
  "newData" JSONB,
  "metadata" JSONB,
  "requestId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "system_audit_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT
);

CREATE INDEX "system_audit_events_organizationId_createdAt_idx" ON "system_audit_events"("organizationId", "createdAt");
CREATE INDEX "system_audit_events_organizationId_entityType_entityId_idx" ON "system_audit_events"("organizationId", "entityType", "entityId");
CREATE INDEX "system_audit_events_organizationId_action_idx" ON "system_audit_events"("organizationId", "action");

CREATE FUNCTION prevent_system_audit_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'system_audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "system_audit_events_immutable"
BEFORE UPDATE OR DELETE ON "system_audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_system_audit_event_mutation();

CREATE TABLE "domain_event_outbox" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "aggregateVersion" INTEGER NOT NULL,
  "eventVersion" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  "metadata" JSONB,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  CONSTRAINT "domain_event_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "domain_event_outbox_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "domain_event_outbox_aggregateVersion_check" CHECK ("aggregateVersion" > 0),
  CONSTRAINT "domain_event_outbox_eventVersion_check" CHECK ("eventVersion" > 0),
  CONSTRAINT "domain_event_outbox_attempts_check" CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX "domain_event_outbox_organizationId_aggregateType_aggregateId_aggregateVersion_eventType_key"
ON "domain_event_outbox"("organizationId", "aggregateType", "aggregateId", "aggregateVersion", "eventType");
CREATE INDEX "domain_event_outbox_status_occurredAt_idx" ON "domain_event_outbox"("status", "occurredAt");
CREATE INDEX "domain_event_outbox_organizationId_aggregateType_aggregateId_idx" ON "domain_event_outbox"("organizationId", "aggregateType", "aggregateId");
CREATE INDEX "domain_event_outbox_pending_occurredAt_idx" ON "domain_event_outbox"("occurredAt") WHERE "status" = 'PENDING';
