-- Phase 1 tenant hardening. Existing records belong to the CNI organization.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "organizations" WHERE "slug" = 'cni' AND "status" = 'ACTIVE') THEN
    RAISE EXCEPTION 'Active CNI organization (slug=cni) is required before tenant backfill';
  END IF;
END $$;

ALTER TABLE "departments" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "cost_centers" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "proveedores" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "oficios" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "audits" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "purchase_order_templates" ADD COLUMN "organizationId" TEXT;

UPDATE "departments" SET "organizationId" = (SELECT "id" FROM "organizations" WHERE "slug" = 'cni') WHERE "organizationId" IS NULL;
UPDATE "cost_centers" SET "organizationId" = (SELECT "id" FROM "organizations" WHERE "slug" = 'cni') WHERE "organizationId" IS NULL;
UPDATE "proveedores" SET "organizationId" = (SELECT "id" FROM "organizations" WHERE "slug" = 'cni') WHERE "organizationId" IS NULL;
UPDATE "oficios" SET "organizationId" = (SELECT "id" FROM "organizations" WHERE "slug" = 'cni') WHERE "organizationId" IS NULL;
UPDATE "audits" SET "organizationId" = (SELECT "id" FROM "organizations" WHERE "slug" = 'cni') WHERE "organizationId" IS NULL;
UPDATE "purchase_order_templates" SET "organizationId" = (SELECT "id" FROM "organizations" WHERE "slug" = 'cni') WHERE "organizationId" IS NULL;
UPDATE "equipment" SET "organizationId" = (SELECT "id" FROM "organizations" WHERE "slug" = 'cni') WHERE "organizationId" IS NULL;
UPDATE "purchase_orders" SET "organizationId" = (SELECT "id" FROM "organizations" WHERE "slug" = 'cni') WHERE "organizationId" IS NULL;
UPDATE "tickets" SET "organizationId" = (SELECT "id" FROM "organizations" WHERE "slug" = 'cni') WHERE "organizationId" IS NULL;
UPDATE "audit_records" SET "organizationId" = (SELECT "id" FROM "organizations" WHERE "slug" = 'cni') WHERE "organizationId" IS NULL;
UPDATE "equipment_assignments" assignment
SET "organizationId" = equipment."organizationId"
FROM "equipment" equipment
WHERE assignment."equipmentId" = equipment."id"
  AND assignment."organizationId" IS DISTINCT FROM equipment."organizationId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "proveedores"
    WHERE NULLIF(BTRIM("rtn"), '') IS NOT NULL
    GROUP BY "organizationId", BTRIM("rtn") HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate supplier RTNs must be resolved before tenant constraints are applied';
  END IF;
END $$;

UPDATE "proveedores" SET "rtn" = NULL WHERE NULLIF(BTRIM("rtn"), '') IS NULL;

CREATE UNIQUE INDEX "departments_organizationId_name_key" ON "departments"("organizationId", "name");
CREATE UNIQUE INDEX "cost_centers_organizationId_code_key" ON "cost_centers"("organizationId", "code");
CREATE UNIQUE INDEX "proveedores_organizationId_rtn_key" ON "proveedores"("organizationId", "rtn");
CREATE UNIQUE INDEX "oficios_organizationId_systemNumber_key" ON "oficios"("organizationId", "systemNumber");
CREATE UNIQUE INDEX "audits_organizationId_code_key" ON "audits"("organizationId", "code");
CREATE UNIQUE INDEX "equipment_organizationId_inventoryCode_key" ON "equipment"("organizationId", "inventoryCode");
CREATE UNIQUE INDEX "equipment_organizationId_serialNumber_key" ON "equipment"("organizationId", "serialNumber");
CREATE UNIQUE INDEX "purchase_orders_organizationId_orderNumber_key" ON "purchase_orders"("organizationId", "orderNumber");
CREATE UNIQUE INDEX "purchase_orders_organizationId_sequenceYear_sequenceNumber_key" ON "purchase_orders"("organizationId", "sequenceYear", "sequenceNumber");

DROP INDEX "departments_name_key";
DROP INDEX "cost_centers_code_key";
DROP INDEX "oficios_systemNumber_key";
DROP INDEX "audits_code_key";
DROP INDEX "equipment_inventoryCode_key";
DROP INDEX "equipment_serialNumber_key";
DROP INDEX "purchase_orders_orderNumber_key";
DROP INDEX "purchase_orders_sequenceYear_sequenceNumber_key";

ALTER TABLE "departments" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "cost_centers" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "proveedores" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "oficios" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "audits" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "purchase_order_templates" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "equipment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "purchase_orders" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "tickets" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "audit_records" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "equipment_assignments" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "departments" ADD CONSTRAINT "departments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "oficios" ADD CONSTRAINT "oficios_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audits" ADD CONSTRAINT "audits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_order_templates" ADD CONSTRAINT "purchase_order_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT;

CREATE INDEX "departments_organizationId_isActive_idx" ON "departments"("organizationId", "isActive");
CREATE INDEX "cost_centers_organizationId_isActive_idx" ON "cost_centers"("organizationId", "isActive");
CREATE INDEX "proveedores_organizationId_activo_idx" ON "proveedores"("organizationId", "activo");
CREATE INDEX "proveedores_organizationId_nombreRazonSocial_idx" ON "proveedores"("organizationId", "nombreRazonSocial");
CREATE INDEX "oficios_organizationId_status_idx" ON "oficios"("organizationId", "status");
CREATE INDEX "audits_organizationId_status_idx" ON "audits"("organizationId", "status");
CREATE INDEX "purchase_order_templates_organizationId_isActive_idx" ON "purchase_order_templates"("organizationId", "isActive");

DROP INDEX "proveedores_activo_idx";
DROP INDEX "proveedores_nombreRazonSocial_idx";
DROP INDEX "purchase_order_templates_isActive_idx";
