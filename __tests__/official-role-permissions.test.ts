import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_ROLE_PERMISSIONS,
  flattenOfficialRolePermissions,
  officialPermissionSetForRole,
} from '@/platform/security/authorization/official-role-permissions';
import { can, organizationRole } from '@/platform/security/authorization/permissions';

describe('official role permission template', () => {
  it('matches can() for every role and permission pair', () => {
    for (const [role, permissions] of Object.entries(OFFICIAL_ROLE_PERMISSIONS)) {
      const scoped = organizationRole(role as keyof typeof OFFICIAL_ROLE_PERMISSIONS);
      for (const permission of permissions) {
        expect(can(scoped, permission)).toBe(true);
      }
    }
  });

  it('flattenOfficialRolePermissions is consistent with per-role sets', () => {
    const flat = flattenOfficialRolePermissions();
    const fromFlat = new Map<string, Set<string>>();
    for (const { role, permission } of flat) {
      if (!fromFlat.has(role)) fromFlat.set(role, new Set());
      fromFlat.get(role)!.add(permission);
    }
    for (const role of Object.keys(OFFICIAL_ROLE_PERMISSIONS) as Array<keyof typeof OFFICIAL_ROLE_PERMISSIONS>) {
      expect(fromFlat.get(role)).toEqual(officialPermissionSetForRole(role));
    }
  });

  it('OWNER and ADMIN include roles.manage and users.*', () => {
    for (const role of ['OWNER', 'ADMIN'] as const) {
      const set = officialPermissionSetForRole(role);
      expect(set.has('roles.manage')).toBe(true);
      expect(set.has('users.read')).toBe(true);
      expect(set.has('users.create')).toBe(true);
      expect(set.has('users.update')).toBe(true);
      expect(set.has('users.deactivate')).toBe(true);
    }
  });

  it('non-admin roles do not include roles.manage in official template', () => {
    expect(officialPermissionSetForRole('ADMINISTRACION').has('roles.manage')).toBe(false);
    expect(officialPermissionSetForRole('HR').has('roles.manage')).toBe(false);
  });
});
