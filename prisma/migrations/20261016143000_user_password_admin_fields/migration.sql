-- Aditive password admin fields (must change on next login, rotation timestamp).

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
