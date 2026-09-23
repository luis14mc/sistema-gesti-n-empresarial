import { describe, expect, it } from 'vitest';
import { PermissionDeniedError } from '@/platform/domain/errors';
import {
  can,
  canWithOverrides,
  organizationRole,
  requirePermission,
  type Permission,
} from '@/platform/security/authorization/permissions';
import {
  ORGANIZATION_ROLE_LABELS,
  PROMOTED_ORGANIZATION_ROLES,
  isPromotedOrganizationRole,
  postLoginPath,
  sessionRoleMatchesAllowlist,
} from '@/platform/security/authorization/roles';
import { hasModuleAccess } from '@/lib/permissions';

const ADMIN_SAMPLES: Permission[] = [
  'equipment.create',
  'purchase-orders.create',
  'employees.create',
  'oficios.create',
  'users.create',
  'audit.read',
];

describe('CNI effective permission matrix', () => {
  it('exposes institutional labels for promoted profiles', () => {
    expect(ORGANIZATION_ROLE_LABELS.ADMIN).toBe('Super Admin');
    expect(ORGANIZATION_ROLE_LABELS.ADMINISTRACION).toBe('Administrativo');
    expect(ORGANIZATION_ROLE_LABELS.SECRETARIA).toBe('Correspondencia');
    expect(ORGANIZATION_ROLE_LABELS.IT_MANAGER).toBe('TI');
    expect(PROMOTED_ORGANIZATION_ROLES.every(isPromotedOrganizationRole)).toBe(true);
    expect(isPromotedOrganizationRole('USER')).toBe(false);
    expect(isPromotedOrganizationRole('HR')).toBe(false);
    expect(postLoginPath('SECRETARIA')).toBe('/oficios/todos');
    expect(postLoginPath('ADMINISTRACION')).toBe('/dashboard');
  });

  it('ADMIN can access representative organization capabilities', () => {
    const role = organizationRole('ADMIN');
    for (const permission of ADMIN_SAMPLES) {
      expect(can(role, permission)).toBe(true);
    }
  });

  it('ADMINISTRACION can operate correspondence, purchases, suppliers and employees', () => {
    const role = organizationRole('ADMINISTRACION');
    expect(can(role, 'oficios.read')).toBe(true);
    expect(can(role, 'oficios.create')).toBe(true);
    expect(can(role, 'oficios.update')).toBe(true);
    expect(can(role, 'oficios.import')).toBe(true);
    expect(can(role, 'purchase-orders.read')).toBe(true);
    expect(can(role, 'purchase-orders.create')).toBe(true);
    expect(can(role, 'purchase-orders.update')).toBe(true);
    expect(can(role, 'purchase-orders.approve')).toBe(true);
    expect(can(role, 'suppliers.read')).toBe(true);
    expect(can(role, 'suppliers.update')).toBe(true);
    expect(can(role, 'employees.read')).toBe(true);
    expect(can(role, 'employees.create')).toBe(true);
    expect(can(role, 'employees.update')).toBe(true);
    expect(can(role, 'employees.deactivate')).toBe(true);
    expect(can(role, 'dashboard.view')).toBe(true);
  });

  it('ADMINISTRACION cannot administer equipment, users, audit or integrations', () => {
    const role = organizationRole('ADMINISTRACION');
    expect(can(role, 'equipment.create')).toBe(false);
    expect(can(role, 'equipment.update')).toBe(false);
    expect(can(role, 'equipment.assign')).toBe(false);
    expect(can(role, 'equipment-disposal.approve')).toBe(false);
    expect(can(role, 'users.create')).toBe(false);
    expect(can(role, 'users.update')).toBe(false);
    expect(can(role, 'audit.read')).toBe(false);
    expect(can(role, 'integrations.update')).toBe(false);
  });

  it('SECRETARIA is limited to oficios', () => {
    const role = organizationRole('SECRETARIA');
    expect(can(role, 'oficios.read')).toBe(true);
    expect(can(role, 'oficios.create')).toBe(true);
    expect(can(role, 'oficios.update')).toBe(true);
    expect(can(role, 'oficios.deactivate')).toBe(true);
    expect(can(role, 'oficios.export')).toBe(true);
    expect(can(role, 'oficios.attachments')).toBe(true);
    expect(can(role, 'oficios.import')).toBe(true);
    expect(can(role, 'dashboard.view')).toBe(false);
    expect(can(role, 'purchase-orders.read')).toBe(false);
    expect(can(role, 'employees.read')).toBe(false);
    expect(can(role, 'equipment.read')).toBe(false);
    expect(can(role, 'users.read')).toBe(false);
  });

  it('IT_MANAGER can run equipment, disposal, users and audit without purchase/employee writes', () => {
    const role = organizationRole('IT_MANAGER');
    expect(can(role, 'equipment.create')).toBe(true);
    expect(can(role, 'equipment.assign')).toBe(true);
    expect(can(role, 'equipment.dispose')).toBe(true);
    expect(can(role, 'equipment-disposal.approve')).toBe(true);
    expect(can(role, 'equipment-disposal.configure')).toBe(true);
    expect(can(role, 'users.create')).toBe(true);
    expect(can(role, 'memberships.manage')).toBe(true);
    expect(can(role, 'audit.read')).toBe(true);
    expect(can(role, 'employees.read')).toBe(true);
    expect(can(role, 'purchase-orders.create')).toBe(false);
    expect(can(role, 'purchase-orders.update')).toBe(false);
    expect(can(role, 'purchase-orders.approve')).toBe(false);
    expect(can(role, 'employees.create')).toBe(false);
    expect(can(role, 'employees.update')).toBe(false);
  });

  it('applies DENY over role ALLOW and ALLOW over role absence', () => {
    const admin = organizationRole('ADMINISTRACION');
    expect(canWithOverrides(admin, 'oficios.create', [
      { permission: 'oficios.create', effect: 'DENY' },
    ])).toBe(false);

    const secretaria = organizationRole('SECRETARIA');
    expect(canWithOverrides(secretaria, 'employees.read', [
      { permission: 'employees.read', effect: 'ALLOW' },
    ])).toBe(true);

    expect(canWithOverrides(secretaria, 'employees.read', [
      { permission: 'employees.read', effect: 'ALLOW' },
      { permission: 'employees.read', effect: 'DENY' },
    ])).toBe(false);
  });

  it('employee API helpers allow ADMINISTRACION and reject SECRETARIA', () => {
    const org = {
      authorizationScope: 'organization' as const,
      userId: 'user-1',
      organizationId: 'org-1',
    };

    expect(() => requirePermission({ ...org, role: 'ADMINISTRACION' }, 'employees.read')).not.toThrow();
    expect(() => requirePermission({ ...org, role: 'ADMINISTRACION' }, 'employees.create')).not.toThrow();
    expect(() => requirePermission({ ...org, role: 'ADMINISTRACION' }, 'employees.update')).not.toThrow();
    expect(() => requirePermission({ ...org, role: 'SECRETARIA' }, 'employees.read')).toThrow(PermissionDeniedError);
    expect(() => requirePermission({ ...org, role: 'SECRETARIA' }, 'employees.create')).toThrow(PermissionDeniedError);
  });

  it('maps IT_MANAGER JWT onto leftover IT route allowlists without mapping Administrativo to RRHH', () => {
    expect(sessionRoleMatchesAllowlist('IT_MANAGER', ['ADMIN', 'IT'])).toBe(true);
    expect(sessionRoleMatchesAllowlist('ADMINISTRACION', ['ADMIN', 'RRHH'])).toBe(false);
    expect(sessionRoleMatchesAllowlist('SECRETARIA', ['ADMIN'])).toBe(false);
  });

  it('hides modules the profile cannot use', () => {
    expect(hasModuleAccess('ADMINISTRACION', 'employees')).toBe(true);
    expect(hasModuleAccess('ADMINISTRACION', 'purchases')).toBe(true);
    expect(hasModuleAccess('ADMINISTRACION', 'users')).toBe(false);
    expect(hasModuleAccess('ADMINISTRACION', 'equipment')).toBe(false);
    expect(hasModuleAccess('SECRETARIA', 'oficios')).toBe(true);
    expect(hasModuleAccess('SECRETARIA', 'dashboard')).toBe(false);
    expect(hasModuleAccess('SECRETARIA', 'purchases')).toBe(false);
    expect(hasModuleAccess('IT_MANAGER', 'users')).toBe(true);
    expect(hasModuleAccess('IT_MANAGER', 'equipment')).toBe(true);
    expect(hasModuleAccess('IT_MANAGER', 'purchases')).toBe(false);
    expect(hasModuleAccess('IT_MANAGER', 'employees')).toBe(false);
  });
});
