ALTER TABLE "equipment" ADD COLUMN "includedAccessories" TEXT;
ALTER TABLE "equipment" ADD COLUMN "installedSoftware" TEXT;

ALTER TABLE "equipment_assignments"
  ADD COLUMN "employeeNameSnapshot" TEXT,
  ADD COLUMN "departmentSnapshot" TEXT,
  ADD COLUMN "positionSnapshot" TEXT,
  ADD COLUMN "inventoryNumberSnapshot" TEXT,
  ADD COLUMN "brandSnapshot" TEXT,
  ADD COLUMN "modelSnapshot" TEXT,
  ADD COLUMN "serialNumberSnapshot" TEXT,
  ADD COLUMN "ramSnapshot" TEXT,
  ADD COLUMN "processorSnapshot" TEXT,
  ADD COLUMN "storageSnapshot" TEXT,
  ADD COLUMN "operatingSystemSnapshot" TEXT,
  ADD COLUMN "accessoriesSnapshot" TEXT,
  ADD COLUMN "softwareSnapshot" TEXT;
