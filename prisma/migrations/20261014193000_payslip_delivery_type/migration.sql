-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PayslipDeliveryType" AS ENUM ('PDF', 'EMAIL', 'PDF_EMAIL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "deliveryType" "PayslipDeliveryType" NOT NULL DEFAULT 'PDF';
