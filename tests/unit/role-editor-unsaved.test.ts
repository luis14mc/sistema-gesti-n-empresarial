import { describe, expect, it } from 'vitest';
import { countUnsavedPermissionChanges } from '@/components/permissions/role-editor-unsaved';
import { MODULE_IDS, type ModuleAccessRow } from '@/platform/security/modules';

function emptyRows(): ModuleAccessRow[] {
  return MODULE_IDS.map((module) => ({
    module,
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    extras: [],
  }));
}

describe('countUnsavedPermissionChanges', () => {
  it('returns 0 when baseline is empty (failed load)', () => {
    expect(countUnsavedPermissionChanges(emptyRows(), [])).toBe(0);
  });
});
