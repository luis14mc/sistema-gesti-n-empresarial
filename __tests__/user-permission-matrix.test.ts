import { describe, expect, it } from 'vitest';
import {
  buildEffectiveModuleMatrix,
  isActionEffective,
  overridesFromDesiredMatrix,
  sessionRoleModuleMatrix,
} from '@/platform/security/module-effective';
import { hasModuleAccess } from '@/lib/permissions';
import { organizationRole } from '@/platform/security/authorization/permissions';

describe('user permission matrix (role + overrides)', () => {
  it('organization role matrix reflects RBAC defaults (ADMIN includes payroll capabilities)', () => {
    expect(buildEffectiveModuleMatrix('ADMIN', []).payroll.canRead).toBe(true);
    expect(buildEffectiveModuleMatrix('HR', []).payroll.canRead).toBe(true);
    expect(buildEffectiveModuleMatrix('IT_MANAGER', []).payroll.canRead).toBe(false);
  });

  it('session nav matrix (lib/permissions) stays independent of org overrides', () => {
    expect(hasModuleAccess('RRHH', 'payroll')).toBe(true);
    expect(hasModuleAccess('RRHH', 'purchases')).toBe(true);
  });

  it('ALLOW override grants Planilla read to IT_MANAGER', () => {
    const overrides = [{ permission: 'payroll.view' as const, effect: 'ALLOW' as const }];
    const matrix = buildEffectiveModuleMatrix('IT_MANAGER', overrides);
    expect(matrix.payroll.canRead).toBe(true);
  });

  it('DENY override removes purchases from ADMINISTRACION', () => {
    expect(isActionEffective('ADMINISTRACION', 'purchases', 'read', [])).toBe(true);
    const overrides = [
      { permission: 'purchase-orders.read' as const, effect: 'DENY' as const },
      { permission: 'purchase-orders.download' as const, effect: 'DENY' as const },
      { permission: 'suppliers.read' as const, effect: 'DENY' as const },
    ];
    expect(isActionEffective('ADMINISTRACION', 'purchases', 'read', overrides)).toBe(false);
  });

  it('returning a cell to role default removes overrides for that action', () => {
    const role = organizationRole('ADMINISTRACION');
    void role;
    const withDeny = [{ permission: 'purchase-orders.read' as const, effect: 'DENY' as const }];
    const desired = sessionRoleModuleMatrix('ADMINISTRACION').purchases;
    const cleared = overridesFromDesiredMatrix('ADMINISTRACION', withDeny, desired);
    expect(cleared.some((o) => o.permission === 'purchase-orders.read')).toBe(false);
  });
});
