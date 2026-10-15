import { describe, expect, it } from 'vitest';
import {
  applyLockedPermissions,
  findMissingLockedPermissions,
} from '@/platform/security/authorization/role-permission-locks';
import {
  createRolePermissionCheck,
  roleHasOrganizationPermission,
} from '@/platform/security/authorization/role-permission-service';
import type { Permission } from '@/platform/security/authorization/permissions';
import type { OrganizationRole } from '@/platform/security/authorization/permissions';
import { canWithOverrides, organizationRole } from '@/platform/security/authorization/permissions';

describe('configurable role permissions', () => {
  it('rejects removing locked permissions for ADMIN', () => {
    const desired: Permission[] = ['dashboard.view'];
    const missing = findMissingLockedPermissions('ADMIN', desired);
    expect(missing).toContain('roles.manage');
    expect(missing).toContain('users.read');
  });

  it('applyLockedPermissions adds mandatory capabilities', () => {
    const set = new Set<Permission>(['dashboard.view']);
    applyLockedPermissions('OWNER', set);
    expect(set.has('roles.manage')).toBe(true);
  });

  it('runtime map denies purchases when removed from ADMINISTRACION', () => {
    const role: OrganizationRole = 'ADMINISTRACION';
    const map = new Map<OrganizationRole, ReadonlySet<Permission>>();
    const withoutPurchases = new Set<Permission>([
      'oficios.read',
      'oficios.create',
      'employees.read',
      'dashboard.view',
      'notifications.read',
    ]);
    map.set(role, withoutPurchases);
    const roleHas = createRolePermissionCheck(role, map);
    expect(roleHas('purchase-orders.read')).toBe(false);
    expect(roleHas('oficios.read')).toBe(true);
    expect(
      canWithOverrides(organizationRole(role), 'purchase-orders.read', [], roleHas),
    ).toBe(false);
  });

  it('falls back to official template when map is null', () => {
    expect(roleHasOrganizationPermission('ADMINISTRACION', 'purchase-orders.read', null)).toBe(true);
  });
});
