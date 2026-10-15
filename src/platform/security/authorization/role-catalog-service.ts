import type { OrganizationRole } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ORGANIZATION_ROLES } from '@/platform/security/authorization/permissions';
import {
  isRoleMatrixModified,
  loadOrganizationRolePermissionMap,
} from '@/platform/security/authorization/role-permission-service';
import { buildRoleModuleMatrix } from '@/platform/security/role-permission-matrix';
import { MODULE_CATALOG, MODULE_IDS } from '@/platform/security/modules';
import { defaultRoleSetting, ROLE_SETTING_DEFAULTS } from '@/platform/security/authorization/role-settings-defaults';

export type RoleCatalogEntry = {
  role: OrganizationRole;
  displayName: string;
  assignable: boolean;
  description: string | null;
  memberCount: number;
  modified: boolean;
  accessibleModuleLabels: string[];
};

type EnsureClient = Prisma.TransactionClient | typeof prisma;

export async function ensureRoleSettingsForOrganization(
  organizationId: string,
  client: EnsureClient = prisma,
): Promise<void> {
  const existing = await client.roleSetting.findMany({
    where: { organizationId },
    select: { role: true },
  });
  const have = new Set(existing.map((row) => row.role));
  const missing = ORGANIZATION_ROLES.filter((role) => !have.has(role));
  if (!missing.length) return;

  await client.roleSetting.createMany({
    data: missing.map((role) => {
      const defaults = ROLE_SETTING_DEFAULTS[role];
      return {
        organizationId,
        role,
        displayName: defaults.displayName,
        assignable: defaults.assignable,
        description: defaults.description,
      };
    }),
    skipDuplicates: true,
  });
}

function accessibleModuleLabelsForRole(
  organizationId: string,
  role: OrganizationRole,
  roleMap: Awaited<ReturnType<typeof loadOrganizationRolePermissionMap>>,
): string[] {
  const matrix = buildRoleModuleMatrix(role, roleMap);
  return MODULE_IDS.filter((id) => matrix[id].canRead).map((id) => MODULE_CATALOG[id].label);
}

export async function getRoleCatalog(
  organizationId: string,
  options?: { assignableOnly?: boolean; includeModuleLabels?: boolean },
): Promise<RoleCatalogEntry[]> {
  await ensureRoleSettingsForOrganization(organizationId);

  const [settings, roleMap, counts] = await Promise.all([
    prisma.roleSetting.findMany({ where: { organizationId } }),
    loadOrganizationRolePermissionMap(organizationId),
    prisma.organizationMembership.groupBy({
      by: ['role'],
      where: { organizationId, status: 'ACTIVE' },
      _count: { _all: true },
    }),
  ]);

  const countByRole = new Map(counts.map((row) => [row.role, row._count._all]));
  const byRole = new Map(settings.map((row) => [row.role, row]));

  let entries: RoleCatalogEntry[] = ORGANIZATION_ROLES.map((role) => {
    const row = byRole.get(role)!;
    const assignable = role === 'ADMIN' ? true : row.assignable;
    return {
      role,
      displayName: row.displayName,
      assignable,
      description: row.description,
      memberCount: countByRole.get(role) ?? 0,
      modified: isRoleMatrixModified(role, roleMap),
      accessibleModuleLabels: [],
    };
  });

  if (options?.assignableOnly) {
    entries = entries.filter((entry) => entry.assignable);
  }

  if (options?.includeModuleLabels !== false) {
    for (const entry of entries) {
      entry.accessibleModuleLabels = accessibleModuleLabelsForRole(organizationId, entry.role, roleMap);
    }
  }

  return entries;
}

export async function getRoleSettingRow(organizationId: string, role: OrganizationRole) {
  await ensureRoleSettingsForOrganization(organizationId);
  const row = await prisma.roleSetting.findUnique({
    where: { organizationId_role: { organizationId, role } },
  });
  if (!row) return { ...defaultRoleSetting(role), role, organizationId };
  return {
    ...row,
    assignable: role === 'ADMIN' ? true : row.assignable,
  };
}

export async function isOrganizationRoleAssignable(
  organizationId: string,
  role: OrganizationRole,
): Promise<boolean> {
  if (role === 'ADMIN') return true;
  await ensureRoleSettingsForOrganization(organizationId);
  const row = await prisma.roleSetting.findUnique({
    where: { organizationId_role: { organizationId, role } },
    select: { assignable: true },
  });
  return row?.assignable ?? defaultRoleSetting(role).assignable;
}
