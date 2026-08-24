ALTER TYPE "OrganizationRole" ADD VALUE IF NOT EXISTS 'ADMINISTRACION';
ALTER TYPE "OrganizationRole" ADD VALUE IF NOT EXISTS 'SECRETARIA';
ALTER TYPE "OrganizationRole" ADD VALUE IF NOT EXISTS 'DIRECTOR';

CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

CREATE TABLE "user_permission_overrides" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "effect" "PermissionEffect" NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_permission_overrides_organizationId_userId_permission_key"
  ON "user_permission_overrides"("organizationId", "userId", "permission");
CREATE INDEX "user_permission_overrides_userId_organizationId_idx"
  ON "user_permission_overrides"("userId", "organizationId");

ALTER TABLE "user_permission_overrides"
  ADD CONSTRAINT "user_permission_overrides_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides"
  ADD CONSTRAINT "user_permission_overrides_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides"
  ADD CONSTRAINT "user_permission_overrides_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
