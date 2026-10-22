import { describe, expect, it } from 'vitest';
import { can, organizationRole } from '@/platform/security/authorization/permissions';
import { canAccess, hasModuleAccess } from '@/platform/security/session-module-access';

describe('payroll permissions', () => {
  it('grants payroll to HR and organization admins; not IT/USER/PROCUREMENT', () => {
    const hr = organizationRole('HR');
    expect(can(hr, 'payroll.view')).toBe(true);
    expect(can(hr, 'payroll.generate')).toBe(true);
    expect(can(hr, 'payroll.configure')).toBe(true);

    expect(can(organizationRole('ADMIN'), 'payroll.view')).toBe(true);
    expect(can(organizationRole('OWNER'), 'payroll.view')).toBe(true);
    expect(can(organizationRole('IT_MANAGER'), 'payroll.view')).toBe(false);
    expect(can(organizationRole('USER'), 'payroll.view')).toBe(false);
    expect(can(organizationRole('PROCUREMENT'), 'payroll.generate')).toBe(false);
  });

  it('maps session roles to payroll UI routes', () => {
    expect(hasModuleAccess('RRHH', 'payroll')).toBe(true);
    expect(hasModuleAccess('ADMIN', 'payroll')).toBe(true);
    expect(hasModuleAccess('OWNER', 'payroll')).toBe(true);
    expect(canAccess('ADMIN', 'payroll', 'read')).toBe(true);
    expect(hasModuleAccess('USER', 'payroll')).toBe(false);
    expect(hasModuleAccess('IT', 'payroll')).toBe(false);
  });
});
