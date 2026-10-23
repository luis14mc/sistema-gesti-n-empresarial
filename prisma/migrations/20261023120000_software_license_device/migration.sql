-- Aditivo e idempotente: tipo DEVICE y vínculo a equipo / clave de licencia

ALTER TYPE "SoftwareSeatType" ADD VALUE IF NOT EXISTS 'DEVICE';

ALTER TABLE "software_license_seats" ADD COLUMN IF NOT EXISTS "equipmentId" TEXT;
ALTER TABLE "software_license_seats" ADD COLUMN IF NOT EXISTS "licenseKey" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'software_license_seats_equipmentId_fkey'
  ) THEN
    ALTER TABLE "software_license_seats"
      ADD CONSTRAINT "software_license_seats_equipmentId_fkey"
      FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "software_license_seats_equipmentId_idx" ON "software_license_seats"("equipmentId");
