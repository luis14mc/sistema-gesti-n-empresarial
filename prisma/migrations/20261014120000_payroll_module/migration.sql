-- CreateEnum
CREATE TYPE "PayslipEmailStatus" AS ENUM ('NONE', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN "monthlySalary" DECIMAL(12,2),
ADD COLUMN "otherDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "otherDeductionNote" TEXT,
ADD COLUMN "payrollEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "payroll_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "medicalExpensesAnnual" DECIMAL(12,2) NOT NULL,
    "ivmDeductibleMonthly" DECIMAL(12,2) NOT NULL,
    "ihssEmRate" DECIMAL(5,2) NOT NULL,
    "ihssIvmRate" DECIMAL(5,2) NOT NULL,
    "ihssCeilingMonthly" DECIMAL(12,2) NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_isr_brackets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "toAnnual" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "payroll_isr_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "salarioPeriodo" DECIMAL(12,2) NOT NULL,
    "ihss" DECIMAL(12,2) NOT NULL,
    "isr" DECIMAL(12,2) NOT NULL,
    "otro" DECIMAL(12,2) NOT NULL,
    "totalDeducciones" DECIMAL(12,2) NOT NULL,
    "neto" DECIMAL(12,2) NOT NULL,
    "parametersSnapshot" JSONB NOT NULL,
    "pdfStorageKey" TEXT,
    "emailStatus" "PayslipEmailStatus" NOT NULL DEFAULT 'NONE',
    "emailError" TEXT,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_settings_organizationId_key" ON "payroll_settings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_isr_brackets_organizationId_year_order_key" ON "payroll_isr_brackets"("organizationId", "year", "order");

-- CreateIndex
CREATE INDEX "payroll_isr_brackets_organizationId_year_idx" ON "payroll_isr_brackets"("organizationId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_organizationId_employeeId_year_month_key" ON "payslips"("organizationId", "employeeId", "year", "month");

-- CreateIndex
CREATE INDEX "payslips_organizationId_year_month_idx" ON "payslips"("organizationId", "year", "month");

-- CreateIndex
CREATE INDEX "payslips_employeeId_idx" ON "payslips"("employeeId");

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_isr_brackets" ADD CONSTRAINT "payroll_isr_brackets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed CNI payroll defaults (idempotent)
INSERT INTO "payroll_settings" (
  "id", "organizationId", "medicalExpensesAnnual", "ivmDeductibleMonthly",
  "ihssEmRate", "ihssIvmRate", "ihssCeilingMonthly", "updatedAt"
)
VALUES (
  'payroll_settings_cni_default',
  'org_cni_default',
  40000.00,
  297.58,
  2.50,
  2.50,
  11903.13,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("organizationId") DO NOTHING;

INSERT INTO "payroll_isr_brackets" ("id", "organizationId", "year", "order", "rate", "toAnnual")
VALUES
  ('payroll_isr_cni_2026_1', 'org_cni_default', 2026, 1, 0.00, 228324.32),
  ('payroll_isr_cni_2026_2', 'org_cni_default', 2026, 2, 15.00, 348154.10),
  ('payroll_isr_cni_2026_3', 'org_cni_default', 2026, 3, 20.00, 809660.75),
  ('payroll_isr_cni_2026_4', 'org_cni_default', 2026, 4, 25.00, 999999999999.99)
ON CONFLICT ("organizationId", "year", "order") DO NOTHING;
