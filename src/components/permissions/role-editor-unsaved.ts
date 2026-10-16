import { MODULE_IDS, type ModuleAccessRow } from '@/platform/security/modules';

export function countUnsavedPermissionChanges(
  current: ModuleAccessRow[],
  baseline: ModuleAccessRow[],
): number {
  if (current.length === 0 || baseline.length === 0) return 0;
  let changes = 0;
  for (const id of MODULE_IDS) {
    const a = current.find((r) => r.module === id);
    const b = baseline.find((r) => r.module === id);
    if (!a || !b) continue;
    if (a.canRead !== b.canRead) changes++;
    if (a.canCreate !== b.canCreate) changes++;
    if (a.canUpdate !== b.canUpdate) changes++;
    if (a.canDelete !== b.canDelete) changes++;
    const extrasA = [...a.extras].sort().join(',');
    const extrasB = [...b.extras].sort().join(',');
    if (extrasA !== extrasB) changes++;
  }
  return changes;
}
