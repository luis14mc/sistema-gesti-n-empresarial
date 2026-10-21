/**
 * Name of the partial unique index enforcing the invariant
 * "one ACTIVE assignment per equipment item" (migration
 * 20260803120000_equipment_assignment_active_unique).
 */
export const ACTIVE_ASSIGNMENT_UNIQUE_INDEX =
  'equipment_assignments_one_active_per_equipment';
