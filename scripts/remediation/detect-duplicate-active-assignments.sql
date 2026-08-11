-- Phase 13 · Part 1 — READ-ONLY duplicate detection.
-- Run BEFORE applying migration 20260803120000_equipment_assignment_active_unique
-- against any environment with real data. This query MUTATES NOTHING.
--
-- Live sweep result (2026-08-03, production Neon): 0 rows. Safe to apply.
--
-- If rows are returned: each is an integrity violation. Do NOT auto-resolve.
-- Reconcile manually (decide which assignment is legitimately active and
-- return/cancel the rest through the normal workflow, preserving history)
-- before applying the unique index.

SELECT
  a."equipmentId",
  e."inventoryCode",
  e."organizationId",
  COUNT(*)                              AS active_count,
  array_agg(a.id ORDER BY a."assignedDate") AS assignment_ids
FROM "equipment_assignments" a
JOIN "equipment" e ON e.id = a."equipmentId"
WHERE a."status" = 'ACTIVE'
GROUP BY a."equipmentId", e."inventoryCode", e."organizationId"
HAVING COUNT(*) > 1
ORDER BY active_count DESC;
