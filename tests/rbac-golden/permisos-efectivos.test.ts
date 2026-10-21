import { describe, expect, it } from 'vitest';
import {
  ORGANIZATION_ROLES,
  canWithOverrides,
  organizationRole,
  type OrganizationRole,
  type Permission,
} from '@/platform/security/authorization/permissions';
import { buildEffectiveModuleMatrix } from '@/platform/security/module-effective';

describe('RBAC golden — permisos efectivos (rol + overrides + role_permissions)', () => {
  for (const role of ORGANIZATION_ROLES) {
    it(`${role}: sin overrides coincide con plantilla oficial (muestra equipment.read)`, () => {
      const perm: Permission = 'equipment.read';
      const scoped = organizationRole(role);
      expect(canWithOverrides(scoped, perm, [])).toBe(canWithOverrides(scoped, perm, [], undefined));
    });
  }

  it('ALLOW otorga un permiso que el rol no tiene en plantilla (USER + payroll.view)', () => {
    const scoped = organizationRole('USER');
    expect(canWithOverrides(scoped, 'payroll.view', [])).toBe(false);
    expect(
      canWithOverrides(scoped, 'payroll.view', [{ permission: 'payroll.view', effect: 'ALLOW' }]),
    ).toBe(true);
  });

  it('DENY quita un permiso que el rol sí tiene (IT_MANAGER + equipment.read)', () => {
    const scoped = organizationRole('IT_MANAGER');
    expect(canWithOverrides(scoped, 'equipment.read', [])).toBe(true);
    expect(
      canWithOverrides(scoped, 'equipment.read', [{ permission: 'equipment.read', effect: 'DENY' }]),
    ).toBe(false);
  });

  it('DENY sobre permiso BLOQUEADO (OWNER users.read / roles.manage) sigue concedido', () => {
    const scoped = organizationRole('OWNER');
    for (const permission of ['users.read', 'roles.manage'] as Permission[]) {
      expect(canWithOverrides(scoped, permission, [{ permission, effect: 'DENY' }])).toBe(true);
    }
  });

  it('matriz personalizada role_permissions distinta de la oficial (PROCUREMENT solo dashboard.view)', () => {
    const orgRole: OrganizationRole = 'PROCUREMENT';
    const roleHas = (permission: Permission) => permission === 'dashboard.view';
    expect(canWithOverrides(organizationRole(orgRole), 'purchase-orders.read', [], roleHas)).toBe(
      false,
    );
    expect(canWithOverrides(organizationRole(orgRole), 'dashboard.view', [], roleHas)).toBe(true);

    const matrix = buildEffectiveModuleMatrix(orgRole, [], roleHas);
    expect(matrix.purchases.canRead).toBe(false);
    expect(matrix.dashboard.canRead).toBe(true);
  });
});
