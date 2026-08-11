-- Phase 7A: organization lifecycle foundation.
-- Adds explicit lifecycle states, onboarding status, and primary contact
-- information required to manage organizations as independent SaaS tenants.
-- Existing organizations keep their current state (ACTIVE / SUSPENDED / INACTIVE).

ALTER TYPE "OrganizationStatus" ADD VALUE IF NOT EXISTS 'PROVISIONING';
ALTER TYPE "OrganizationStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "OrganizationStatus" ADD VALUE IF NOT EXISTS 'PENDING_DELETION';

ALTER TYPE "MembershipStatus" ADD VALUE IF NOT EXISTS 'INVITED';
ALTER TYPE "MembershipStatus" ADD VALUE IF NOT EXISTS 'REVOKED';

CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'es-HN',
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'HNL',
  ADD COLUMN IF NOT EXISTS "primaryContactName" TEXT,
  ADD COLUMN IF NOT EXISTS "primaryContactEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "primaryContactPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletionRequestedAt" TIMESTAMP(3);

-- Existing tenants are already ACTIVE; reflect that explicitly so the new
-- default of PROVISIONING does not affect operational organizations such as CNI.
UPDATE "organizations"
SET "activatedAt" = COALESCE("activatedAt", "createdAt")
WHERE "status" = 'ACTIVE' AND "activatedAt" IS NULL;

UPDATE "organizations"
SET "onboardingStatus" = 'COMPLETED'
WHERE "status" IN ('ACTIVE', 'SUSPENDED', 'INACTIVE');

CREATE INDEX IF NOT EXISTS "organizations_status_idx" ON "organizations"("status");
CREATE INDEX IF NOT EXISTS "organizations_onboardingStatus_idx" ON "organizations"("onboardingStatus");
