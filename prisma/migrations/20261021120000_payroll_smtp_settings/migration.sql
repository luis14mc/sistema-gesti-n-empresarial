-- Payroll SMTP settings per organization (editable from Planilla → Configuración)

CREATE TABLE IF NOT EXISTS "payroll_smtp_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "passwordEncrypted" TEXT,
    "senderName" TEXT NOT NULL DEFAULT 'Servicios Online',
    "fromAddress" TEXT NOT NULL DEFAULT 'notificaciones@cni.hn',
    "replyTo" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_smtp_settings_organizationId_key"
    ON "payroll_smtp_settings"("organizationId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payroll_smtp_settings_organizationId_fkey'
    ) THEN
        ALTER TABLE "payroll_smtp_settings"
            ADD CONSTRAINT "payroll_smtp_settings_organizationId_fkey"
            FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payroll_smtp_settings_updatedById_fkey'
    ) THEN
        ALTER TABLE "payroll_smtp_settings"
            ADD CONSTRAINT "payroll_smtp_settings_updatedById_fkey"
            FOREIGN KEY ("updatedById") REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
    END IF;
END $$;
