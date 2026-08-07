-- Phase S4 Equipment · Drift detection in equipment-disposal workflow.
--
-- Closes A-2 (HIGH): `restoreAndClose` previously blindly restored
-- `equipment.status` to `previousEquipmentStatus` even if the equipment had
-- drifted out of `DISPOSAL_IN_PROGRESS` (e.g., via maintenance flow). Now the
-- helper records the drift and aborts, requiring manual investigation.

ALTER TYPE "DisposalHistoryAction" ADD VALUE IF NOT EXISTS 'EQUIPMENT_STATUS_DRIFT_DETECTED';
