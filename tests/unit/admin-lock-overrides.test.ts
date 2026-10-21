import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canWithOverrides,
  organizationRole,
  type PermissionOverride,
} from '@/platform/security/authorization/permissions';
import {
  findDenyOverridesOnLockedPermissions,
  lockedPermissionsForRole,
} from '@/platform/security/authorization/role-permission-locks';
import { overridesFromDesiredMatrix } from '@/platform/security/module-effective';
import { createRolePermissionCheck } from '@/platform/security/authorization/role-permission-service';
import { isPermissionEffective } from '@/platform/security/module-effective';

describe('admin lock overrides', () => {
  it('ADMIN with DENY on roles.manage still has effective access (lock before DENY)', () => {
    const overrides: PermissionOverride[] = [{ permission: 'roles.manage', effect: 'DENY' }];
    expect(
      canWithOverrides(organizationRole('ADMIN'), 'roles.manage', overrides),
    ).toBe(true);
    expect(
      isPermissionEffective('ADMIN', 'roles.manage', overrides),
    ).toBe(true);
  });

  it('ADMINISTRACION DENY on oficios.create is still honored (not locked)', () => {
    expect(
      canWithOverrides(organizationRole('ADMINISTRACION'), 'oficios.create', [
        { permission: 'oficios.create', effect: 'DENY' },
      ]),
    ).toBe(false);
  });

  it('findDenyOverridesOnLockedPermissions detects illegal DENY rows', () => {
    const illegal = findDenyOverridesOnLockedPermissions('ADMIN', [
      { permission: 'roles.manage', effect: 'DENY' },
      { permission: 'oficios.read', effect: 'DENY' },
    ]);
    expect(illegal).toEqual(['roles.manage']);
    expect(findDenyOverridesOnLockedPermissions('USER', [
      { permission: 'roles.manage', effect: 'DENY' },
    ])).toEqual([]);
  });

  it('overridesFromDesiredMatrix does not create DENY on locked permissions', () => {
    const roleHas = createRolePermissionCheck('ADMIN', null);
    const desired = {
      module: 'settings' as const,
      canRead: false,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      extras: [],
    };
    const next = overridesFromDesiredMatrix('ADMIN', [], desired, roleHas);
    const deniesOnLocked = findDenyOverridesOnLockedPermissions('ADMIN', next);
    expect(deniesOnLocked).toEqual([]);
  });

  it('locked permissions list matches migration predicate', () => {
    expect([...lockedPermissionsForRole('ADMIN')]).toEqual([
      'users.read',
      'users.create',
      'users.update',
      'users.deactivate',
      'roles.manage',
    ]);
  });
});

describe('PUT /api/users/[id]/permissions locked DENY guard', () => {
  it('returns 400 when computed overrides still contain DENY on locked permissions', () => {
    const illegal = findDenyOverridesOnLockedPermissions('ADMIN', [
      { permission: 'users.read', effect: 'DENY' },
    ]);
    expect(illegal.length).toBeGreaterThan(0);
    expect(illegal).toContain('users.read');
  });
});

describe('PATCH /api/users last Super Admin guard', () => {
  it('blocks demoting the last active Super Admin', async () => {
    vi.resetModules();
    const prismaMock = {
      organizationMembership: {
        findFirst: vi.fn(async () => ({
          id: 'm1',
          role: 'ADMIN',
          user: { role: 'ADMIN', isActive: true, firstName: 'A', lastName: 'B' },
        })),
        count: vi.fn(async () => 0),
      },
      user: { update: vi.fn() },
      $transaction: vi.fn(),
    };
    vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    vi.doMock('@/platform/api/with-auth', () => ({
      withAuth: (handler: (...args: unknown[]) => unknown) => handler,
    }));
    vi.doMock('@/platform/security/authorization/http', () => ({
      authorizeOrganization: vi.fn(async () => ({
        organizationId: 'org-1',
        userId: 'other-admin',
      })),
    }));
    vi.doMock('@/platform/security/authorization/role-catalog-service', () => ({
      isOrganizationRoleAssignable: vi.fn(async () => true),
    }));
    vi.doMock('@/platform/security/audit/audit-record', () => ({ createAuditRecord: vi.fn() }));

    const { PATCH } = await import('@/app/api/users/route');
    const res = await PATCH(
      {
        user: { userId: 'other-admin' },
        json: async () => ({ id: 'admin-1', role: 'USER' }),
      } as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Super Admin activo/i);
  });
});

describe('migration 20261016160000_remove_admin_locked_deny_overrides', () => {
  it('deletes only DENY overrides on locked permissions for OWNER/ADMIN memberships', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'prisma/migrations/20261016160000_remove_admin_locked_deny_overrides/migration.sql',
      ),
      'utf8',
    );
    expect(sql).toContain("'DENY'");
    expect(sql).toContain('users.read');
    expect(sql).toContain('roles.manage');
    expect(sql).toContain('RAISE NOTICE');
    expect(sql).toContain('organization_memberships');
    expect(sql).not.toContain("'ALLOW'");
  });
});
