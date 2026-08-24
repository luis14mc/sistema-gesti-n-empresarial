ALTER TABLE "employees" ADD COLUMN "hireDate" DATE;

CREATE INDEX "employees_organizationId_hireDate_idx" ON "employees"("organizationId", "hireDate");
