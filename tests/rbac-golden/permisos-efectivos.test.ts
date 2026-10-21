import { describe, expect, it } from 'vitest';
import {
  canWithOverrides,
  organizationRole,
  type OrganizationRole,
  type Permission,
} from '@/platform/security/authorization/permissions';
import { buildEffectiveModuleMatrix } from '@/platform/security/module-effective';
import officialMatrix from './__fixtures__/official-matrix.json';

type OfficialMatrixRow = {
  role: OrganizationRole;
  permission: Permission;
  officialGranted: boolean;
  locked: boolean;
};

const matrixRows = officialMatrix as OfficialMatrixRow[];

describe('RBAC golden — permisos efectivos (rol + overrides + role_permissions)', () => {
  it('canWithOverrides alineado con cada fila de official-matrix.json', () => {
    for (const { role, permission, officialGranted, locked } of matrixRows) {
      const scoped = organizationRole(role);

      expect(canWithOverrides(scoped, permission, [])).toBe(officialGranted);

      const withDeny = canWithOverrides(scoped, permission, [{ permission, effect: 'DENY' }]);
      expect(withDeny).toBe(locked ? true : false);

      expect(
        canWithOverrides(scoped, permission, [{ permission, effect: 'ALLOW' }]),
      ).toBe(true);
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
