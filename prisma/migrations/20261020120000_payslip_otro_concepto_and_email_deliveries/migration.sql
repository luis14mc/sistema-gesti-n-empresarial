-- Payslip "Otro" concept label (per generated payslip)
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "otroConcepto" TEXT;

-- Email delivery tracking (SMTP sends per payslip)
DO $$ BEGIN
  CREATE TYPE "PayslipEmailDeliveryStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "payslip_email_deliveries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "status" "PayslipEmailDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "messageId" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "payslip_email_deliveries_organizationId_status_idx"
  ON "payslip_email_deliveries"("organizationId", "status");

CREATE INDEX IF NOT EXISTS "payslip_email_deliveries_payslipId_idx"
  ON "payslip_email_deliveries"("payslipId");

DO $$ BEGIN
  ALTER TABLE "payslip_email_deliveries"
    ADD CONSTRAINT "payslip_email_deliveries_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "payslip_email_deliveries"
    ADD CONSTRAINT "payslip_email_deliveries_payslipId_fkey"
    FOREIGN KEY ("payslipId") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "payslip_email_deliveries"
    ADD CONSTRAINT "payslip_email_deliveries_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
