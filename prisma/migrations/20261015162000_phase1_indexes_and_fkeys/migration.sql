-- N5 aditivo: indexes and user FKs on active tables (IF NOT EXISTS / NOT VALID + validate when no orphans).

CREATE INDEX IF NOT EXISTS "equipment_organizationId_createdAt_idx" ON "equipment"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "purchase_orders_organizationId_createdAt_idx" ON "purchase_orders"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "oficios_organizationId_createdAt_idx" ON "oficios"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "employees_organizationId_createdAt_idx" ON "employees"("organizationId", "createdAt");

-- payslips.generatedById (required)
DO $$
DECLARE orphan_count bigint;
BEGIN
  IF to_regclass('public.payslips') IS NULL THEN RETURN; END IF;
  SELECT COUNT(*) INTO orphan_count
  FROM payslips p
  LEFT JOIN users u ON u.id = p."generatedById"
  WHERE u.id IS NULL;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payslips_generatedById_fkey') THEN
    ALTER TABLE payslips
      ADD CONSTRAINT "payslips_generatedById_fkey"
      FOREIGN KEY ("generatedById") REFERENCES users(id) ON DELETE RESTRICT NOT VALID;
    IF orphan_count = 0 THEN
      ALTER TABLE payslips VALIDATE CONSTRAINT "payslips_generatedById_fkey";
    END IF;
  END IF;
END $$;

-- payroll_settings.updatedById (optional)
DO $$
DECLARE orphan_count bigint;
BEGIN
  IF to_regclass('public.payroll_settings') IS NULL THEN RETURN; END IF;
  SELECT COUNT(*) INTO orphan_count
  FROM payroll_settings p
  LEFT JOIN users u ON u.id = p."updatedById"
  WHERE p."updatedById" IS NOT NULL AND u.id IS NULL;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_settings_updatedById_fkey') THEN
    ALTER TABLE payroll_settings
      ADD CONSTRAINT "payroll_settings_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES users(id) ON DELETE SET NULL NOT VALID;
    IF orphan_count = 0 THEN
      ALTER TABLE payroll_settings VALIDATE CONSTRAINT "payroll_settings_updatedById_fkey";
    END IF;
  END IF;
END $$;

-- equipment_history.performedById (optional)
DO $$
DECLARE orphan_count bigint;
BEGIN
  IF to_regclass('public.equipment_history') IS NULL THEN RETURN; END IF;
  SELECT COUNT(*) INTO orphan_count
  FROM equipment_history h
  LEFT JOIN users u ON u.id = h."performedById"
  WHERE h."performedById" IS NOT NULL AND u.id IS NULL;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_history_performedById_fkey') THEN
    ALTER TABLE equipment_history
      ADD CONSTRAINT "equipment_history_performedById_fkey"
      FOREIGN KEY ("performedById") REFERENCES users(id) ON DELETE SET NULL NOT VALID;
    IF orphan_count = 0 THEN
      ALTER TABLE equipment_history VALIDATE CONSTRAINT "equipment_history_performedById_fkey";
    END IF;
  END IF;
END $$;

-- equipment_maintenances.performedById (optional)
DO $$
DECLARE orphan_count bigint;
BEGIN
  IF to_regclass('public.equipment_maintenances') IS NULL THEN RETURN; END IF;
  SELECT COUNT(*) INTO orphan_count
  FROM equipment_maintenances m
  LEFT JOIN users u ON u.id = m."performedById"
  WHERE m."performedById" IS NOT NULL AND u.id IS NULL;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_maintenances_performedById_fkey') THEN
    ALTER TABLE equipment_maintenances
      ADD CONSTRAINT "equipment_maintenances_performedById_fkey"
      FOREIGN KEY ("performedById") REFERENCES users(id) ON DELETE SET NULL NOT VALID;
    IF orphan_count = 0 THEN
      ALTER TABLE equipment_maintenances VALIDATE CONSTRAINT "equipment_maintenances_performedById_fkey";
    END IF;
  END IF;
END $$;

-- software_subscriptions.createdById / updatedById
DO $$
DECLARE orphan_created bigint;
DECLARE orphan_updated bigint;
BEGIN
  IF to_regclass('public.software_subscriptions') IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO orphan_created
  FROM software_subscriptions s
  LEFT JOIN users u ON u.id = s."createdById"
  WHERE u.id IS NULL;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'software_subscriptions_createdById_fkey') THEN
    ALTER TABLE software_subscriptions
      ADD CONSTRAINT "software_subscriptions_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES users(id) ON DELETE RESTRICT NOT VALID;
    IF orphan_created = 0 THEN
      ALTER TABLE software_subscriptions VALIDATE CONSTRAINT "software_subscriptions_createdById_fkey";
    END IF;
  END IF;

  SELECT COUNT(*) INTO orphan_updated
  FROM software_subscriptions s
  LEFT JOIN users u ON u.id = s."updatedById"
  WHERE s."updatedById" IS NOT NULL AND u.id IS NULL;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'software_subscriptions_updatedById_fkey') THEN
    ALTER TABLE software_subscriptions
      ADD CONSTRAINT "software_subscriptions_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES users(id) ON DELETE SET NULL NOT VALID;
    IF orphan_updated = 0 THEN
      ALTER TABLE software_subscriptions VALIDATE CONSTRAINT "software_subscriptions_updatedById_fkey";
    END IF;
  END IF;
END $$;
