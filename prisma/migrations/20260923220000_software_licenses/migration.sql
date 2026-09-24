CREATE TYPE "SoftwareBillingCycle" AS ENUM ('MONTHLY', 'ANNUAL', 'QUARTERLY', 'OTHER');
CREATE TYPE "SoftwareCurrency" AS ENUM ('USD', 'HNL');
CREATE TYPE "SoftwareSubscriptionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "SoftwareSeatType" AS ENUM ('INDIVIDUAL', 'SHARED');
CREATE TYPE "SoftwareSeatStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'SUSPENDED', 'CANCELLED');

CREATE TABLE "software_products" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "vendor" TEXT,
  "category" TEXT,
  "description" TEXT,
  "website" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "software_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "software_subscriptions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "planName" TEXT NOT NULL,
  "totalSeats" INTEGER NOT NULL,
  "billingCycle" "SoftwareBillingCycle" NOT NULL,
  "currency" "SoftwareCurrency" NOT NULL DEFAULT 'USD',
  "billingAmount" DECIMAL(14,2) NOT NULL,
  "monthlyCost" DECIMAL(14,2) NOT NULL,
  "annualCost" DECIMAL(14,2) NOT NULL,
  "startDate" DATE NOT NULL,
  "renewalDate" DATE,
  "paymentDay" INTEGER,
  "autoRenew" BOOLEAN NOT NULL DEFAULT true,
  "status" "SoftwareSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "expiringSoonDays" INTEGER NOT NULL DEFAULT 30,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "software_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "software_license_seats" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "accountEmail" TEXT,
  "accountIdentifier" TEXT,
  "seatType" "SoftwareSeatType" NOT NULL DEFAULT 'INDIVIDUAL',
  "status" "SoftwareSeatStatus" NOT NULL DEFAULT 'AVAILABLE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "software_license_seats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "software_license_assignments" (
  "id" TEXT NOT NULL,
  "seatId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unassignedAt" TIMESTAMP(3),
  "assignedById" TEXT NOT NULL,
  "unassignedById" TEXT,
  "notes" TEXT,
  CONSTRAINT "software_license_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "software_products_organizationId_name_key" ON "software_products"("organizationId", "name");
CREATE INDEX "software_products_organizationId_active_idx" ON "software_products"("organizationId", "active");
CREATE INDEX "software_subscriptions_organizationId_status_idx" ON "software_subscriptions"("organizationId", "status");
CREATE INDEX "software_subscriptions_organizationId_renewalDate_idx" ON "software_subscriptions"("organizationId", "renewalDate");
CREATE INDEX "software_subscriptions_productId_idx" ON "software_subscriptions"("productId");
CREATE INDEX "software_license_seats_subscriptionId_status_idx" ON "software_license_seats"("subscriptionId", "status");
CREATE INDEX "software_license_seats_accountEmail_idx" ON "software_license_seats"("accountEmail");
CREATE INDEX "software_license_assignments_seatId_unassignedAt_idx" ON "software_license_assignments"("seatId", "unassignedAt");
CREATE INDEX "software_license_assignments_employeeId_idx" ON "software_license_assignments"("employeeId");

ALTER TABLE "software_products" ADD CONSTRAINT "software_products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "software_subscriptions" ADD CONSTRAINT "software_subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "software_subscriptions" ADD CONSTRAINT "software_subscriptions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "software_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "software_license_seats" ADD CONSTRAINT "software_license_seats_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "software_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "software_license_assignments" ADD CONSTRAINT "software_license_assignments_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "software_license_seats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "software_license_assignments" ADD CONSTRAINT "software_license_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
