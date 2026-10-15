import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { OrganizationRole } from '@prisma/client';
import { ORGANIZATION_ROLES } from '@/platform/security/authorization/permissions';
import { ROLE_SETTING_DEFAULTS } from '@/platform/security/authorization/role-settings-defaults';
import {
  ensureRoleSettingsForOrganization,
  getRoleCatalog,
  isOrganizationRoleAssignable,
} from '@/platform/security/authorization/role-catalog-service';
import { parseOrganizationRole, persistUserAccountRoles } from '@/platform/security/authorization/user-account-roles';
import { buildRoleModuleMatrix } from '@/platform/security/role-permission-matrix';

const orgId = 'org_test';

const roleSettingFindMany = vi.fn();
const roleSettingCreateMany = vi.fn();
const roleSettingFindUnique = vi.fn();
const roleSettingUpdate = vi.fn();
const groupBy = vi.fn();
const rolePermissionFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    roleSetting: {
      findMany: (...args: unknown[]) => roleSettingFindMany(...args),
      createMany: (...args: unknown[]) => roleSettingCreateMany(...args),
      findUnique: (...args: unknown[]) => roleSettingFindUnique(...args),
      update: (...args: unknown[]) => roleSettingUpdate(...args),
    },
    organizationMembership: {
      groupBy: (...args: unknown[]) => groupBy(...args),
    },
    rolePermission: {
      findMany: (...args: unknown[]) => rolePermissionFindMany(...args),
    },
  },
}));

function seedAllSettings(overrides?: Partial<Record<OrganizationRole, { assignable: boolean }>>) {
  roleSettingFindMany.mockResolvedValue(
    ORGANIZATION_ROLES.map((role) => ({
      role,
      displayName: ROLE_SETTING_DEFAULTS[role].displayName,
      assignable: overrides?.[role]?.assignable ?? ROLE_SETTING_DEFAULTS[role].assignable,
      description: null,
      organizationId: orgId,
    })),
  );
}

describe('role catalog assignable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    roleSettingCreateMany.mockResolvedValue({ count: 0 });
    groupBy.mockResolvedValue([]);
    rolePermissionFindMany.mockResolvedValue([]);
  });

  it('seeds defaults with four assignable promoted roles', () => {
    expect(ROLE_SETTING_DEFAULTS.ADMIN.assignable).toBe(true);
    expect(ROLE_SETTING_DEFAULTS.HR.assignable).toBe(false);
    expect(ROLE_SETTING_DEFAULTS.HR.displayName).toBe('Recursos Humanos');
    expect(ROLE_SETTING_DEFAULTS.OWNER.displayName).toBe('Propietario');
  });

  it('getRoleCatalog assignableOnly returns only assignable roles', async () => {
    seedAllSettings({ HR: { assignable: true } });
    const all = await getRoleCatalog(orgId, { assignableOnly: false, includeModuleLabels: false });
    const assignable = await getRoleCatalog(orgId, { assignableOnly: true, includeModuleLabels: false });
    expect(all.length).toBe(ORGANIZATION_ROLES.length);
    expect(assignable.some((r) => r.role === 'HR')).toBe(true);
    expect(assignable.some((r) => r.role === 'USER')).toBe(false);
  });

  it('ADMIN is always assignable', async () => {
    seedAllSettings({ ADMIN: { assignable: false } });
    roleSettingFindUnique.mockResolvedValue({
      role: 'ADMIN',
      assignable: false,
      displayName: 'Super Admin',
    });
    await expect(isOrganizationRoleAssignable(orgId, 'ADMIN')).resolves.toBe(true);
  });

  it('parseOrganizationRole accepts HR and rejects unknown', () => {
    expect(parseOrganizationRole('HR')).toBe('HR');
    expect(parseOrganizationRole('NOT_A_ROLE')).toBeNull();
  });

  it('persistUserAccountRoles maps HR membership to legacy RRHH user role', () => {
    const mapped = persistUserAccountRoles('HR');
    expect(mapped.membershipRole).toBe('HR');
    expect(mapped.prismaUserRole).toBe('RRHH');
  });

  it('OWNER/ADMIN matrix includes locked roles.manage special on settings', () => {
    const matrix = buildRoleModuleMatrix('ADMIN', null);
    expect(matrix.settings.extras).toContain('roles.manage');
  });

  it('ensureRoleSettingsForOrganization creates missing rows once', async () => {
    roleSettingFindMany.mockResolvedValueOnce([]).mockResolvedValue(
      ORGANIZATION_ROLES.map((role) => ({
        role,
        displayName: ROLE_SETTING_DEFAULTS[role].displayName,
        assignable: ROLE_SETTING_DEFAULTS[role].assignable,
      })),
    );
    await ensureRoleSettingsForOrganization(orgId);
    expect(roleSettingCreateMany).toHaveBeenCalledTimes(1);
    expect(roleSettingCreateMany.mock.calls[0][0].data.length).toBe(ORGANIZATION_ROLES.length);
  });
});
