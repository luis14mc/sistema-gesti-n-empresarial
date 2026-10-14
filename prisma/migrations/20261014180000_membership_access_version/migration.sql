-- AlterTable
ALTER TABLE "organization_memberships" ADD COLUMN IF NOT EXISTS "accessVersion" INTEGER NOT NULL DEFAULT 0;
