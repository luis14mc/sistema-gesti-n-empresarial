-- CreateTable
CREATE TABLE "role_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "displayName" TEXT NOT NULL,
    "assignable" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_settings_organizationId_role_key" ON "role_settings"("organizationId", "role");

-- CreateIndex
CREATE INDEX "role_settings_organizationId_assignable_idx" ON "role_settings"("organizationId", "assignable");

-- AddForeignKey
ALTER TABLE "role_settings" ADD CONSTRAINT "role_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_settings" ADD CONSTRAINT "role_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
