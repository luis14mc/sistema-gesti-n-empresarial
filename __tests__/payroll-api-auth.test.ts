import { describe, expect, it } from 'vitest';
import { can, organizationRole } from '@/platform/security/authorization/permissions';

/** Static RBAC matrix for payroll API (mirrors route authorizeOrganization checks). */
describe('payroll API authorization matrix', () => {
  it('allows HR for view, generate, and configure', () => {
    const hr = organizationRole('HR');
    expect(can(hr, 'payroll.view')).toBe(true);
    expect(can(hr, 'payroll.generate')).toBe(true);
    expect(can(hr, 'payroll.configure')).toBe(true);
  });

  it('allows organization ADMIN and OWNER', () => {
    expect(can(organizationRole('ADMIN'), 'payroll.view')).toBe(true);
    expect(can(organizationRole('OWNER'), 'payroll.generate')).toBe(true);
  });

  it('denies IT, USER, and PROCUREMENT', () => {
    for (const role of ['IT_MANAGER', 'USER', 'PROCUREMENT'] as const) {
      const scoped = organizationRole(role);
      expect(can(scoped, 'payroll.view')).toBe(false);
      expect(can(scoped, 'payroll.generate')).toBe(false);
    }
  });
});
