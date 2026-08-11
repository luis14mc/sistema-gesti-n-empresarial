import { describe, expect, it } from 'vitest';
import { can, requirePermission, type Permission, type ScopedRole } from '@/platform/security/authorization/permissions';

const PLATFORM_PERMISSIONS: readonly Permission[] = [
  'platform.health.read',
  'platform.audit.read',
  'reports.platform',
] as const;

function asOrg(role: 'OWNER' | 'ADMIN' | 'IT_MANAGER' | 'IT_TECHNICIAN' | 'PROCUREMENT' | 'HR' | 'AUDITOR' | 'USER'): ScopedRole {
  return { scope: 'organization', role };
}

function asPlatform(role: 'PLATFORM_ADMIN' | 'SUPPORT_ADMIN'): ScopedRole {
  return { scope: 'platform', role };
}

describe('Integration permission matrix (Phase 10A security regression)', () => {
  const integrationPermissions: readonly Permission[] = [
    'integrations.read',
    'integrations.create',
    'integrations.update',
    'integrations.enable',
    'integrations.disable',
    'integrations.test',
    'integrations.rotate-credentials',
    'integrations.view-history',
    'integrations.retry',
    'webhooks.manage',
  ];

  it('OWNER has every integration permission', () => {
    for (const permission of integrationPermissions) {
      expect(can(asOrg('OWNER'), permission)).toBe(true);
    }
  });

  it('ADMIN has every integration permission', () => {
    for (const permission of integrationPermissions) {
      expect(can(asOrg('ADMIN'), permission)).toBe(true);
    }
  });

  it('IT_MANAGER has the read/test/view-history subset, but cannot create or rotate', () => {
    expect(can(asOrg('IT_MANAGER'), 'integrations.read')).toBe(true);
    expect(can(asOrg('IT_MANAGER'), 'integrations.test')).toBe(true);
    expect(can(asOrg('IT_MANAGER'), 'integrations.view-history')).toBe(true);
    expect(can(asOrg('IT_MANAGER'), 'integrations.create')).toBe(false);
    expect(can(asOrg('IT_MANAGER'), 'integrations.rotate-credentials')).toBe(false);
    expect(can(asOrg('IT_MANAGER'), 'webhooks.manage')).toBe(false);
  });

  it('AUDITOR can read and view history but cannot mutate', () => {
    expect(can(asOrg('AUDITOR'), 'integrations.read')).toBe(true);
    expect(can(asOrg('AUDITOR'), 'integrations.view-history')).toBe(true);
    expect(can(asOrg('AUDITOR'), 'integrations.create')).toBe(false);
    expect(can(asOrg('AUDITOR'), 'integrations.rotate-credentials')).toBe(false);
    expect(can(asOrg('AUDITOR'), 'integrations.enable')).toBe(false);
  });

  it('USER has no integration permission', () => {
    for (const permission of integrationPermissions) {
      expect(can(asOrg('USER'), permission)).toBe(false);
    }
  });

  it('PROCUREMENT cannot manage webhooks', () => {
    expect(can(asOrg('PROCUREMENT'), 'webhooks.manage')).toBe(false);
  });

  it('platform roles do not silently gain organization integration rights', () => {
    expect(can(asPlatform('PLATFORM_ADMIN'), 'integrations.create')).toBe(false);
    expect(can(asPlatform('PLATFORM_ADMIN'), 'integrations.read')).toBe(false);
    expect(can(asPlatform('SUPPORT_ADMIN'), 'integrations.read')).toBe(false);
  });
});

describe('Notification permission matrix (Phase 10A security regression)', () => {
  it('OWNER and ADMIN can manage organization notification settings and retry failures', () => {
    expect(can(asOrg('OWNER'), 'notifications.read')).toBe(true);
    expect(can(asOrg('OWNER'), 'notifications.manage-organization-settings')).toBe(true);
    expect(can(asOrg('OWNER'), 'notifications.retry-failed')).toBe(true);
    expect(can(asOrg('OWNER'), 'notifications.view-deliveries')).toBe(true);
    expect(can(asOrg('ADMIN'), 'notifications.manage-organization-settings')).toBe(true);
  });

  it('every organization role can read notifications', () => {
    const roles: Array<'OWNER' | 'ADMIN' | 'IT_MANAGER' | 'IT_TECHNICIAN' | 'PROCUREMENT' | 'HR' | 'AUDITOR' | 'USER'> = [
      'OWNER', 'ADMIN', 'IT_MANAGER', 'IT_TECHNICIAN', 'PROCUREMENT', 'HR', 'AUDITOR', 'USER',
    ];
    for (const role of roles) {
      expect(can(asOrg(role), 'notifications.read')).toBe(true);
    }
  });

  it('IT_MANAGER can manage their own preferences but not organization-wide settings', () => {
    expect(can(asOrg('IT_MANAGER'), 'notifications.manage-own-preferences')).toBe(true);
    expect(can(asOrg('IT_MANAGER'), 'notifications.manage-organization-settings')).toBe(false);
  });

  it('USER can read but cannot manage anything', () => {
    expect(can(asOrg('USER'), 'notifications.manage-own-preferences')).toBe(false);
    expect(can(asOrg('USER'), 'notifications.manage-organization-settings')).toBe(false);
    expect(can(asOrg('USER'), 'notifications.retry-failed')).toBe(false);
  });
});

describe('requirePermission (Phase 10A security regression)', () => {
  it('throws PermissionDeniedError when a permission is missing', () => {
    expect(() => requirePermission({ authorizationScope: 'organization', organizationId: 'org-a', userId: 'u-1', role: 'USER' }, 'integrations.create'))
      .toThrow(/permiso/i);
  });

  it('does not throw when the permission is granted', () => {
    expect(() => requirePermission({ authorizationScope: 'organization', organizationId: 'org-a', userId: 'u-1', role: 'OWNER' }, 'integrations.create'))
      .not.toThrow();
  });

  it('does not allow platform role to bypass organization permission check', () => {
    expect(() => requirePermission({ authorizationScope: 'platform', userId: 'u-1', role: 'PLATFORM_ADMIN' }, 'integrations.create'))
      .toThrow(/permiso/i);
  });
});

describe('Platform permission isolation (Phase 10A security regression)', () => {
  it('SUPPORT_ADMIN has only platform.health.read', () => {
    expect(can(asPlatform('SUPPORT_ADMIN'), 'platform.health.read')).toBe(true);
    for (const permission of PLATFORM_PERMISSIONS) {
      if (permission === 'platform.health.read') continue;
      expect(can(asPlatform('SUPPORT_ADMIN'), permission)).toBe(false);
    }
  });

  it('PLATFORM_ADMIN has every platform permission', () => {
    for (const permission of PLATFORM_PERMISSIONS) {
      expect(can(asPlatform('PLATFORM_ADMIN'), permission)).toBe(true);
    }
  });
});
