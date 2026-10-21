import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@/platform/security/authorization/permissions';
import type { Prisma } from '@prisma/client';
import { bumpOrganizationRoleAccessVersion } from '@/platform/security/authorization/role-permission-service';

export async function countActiveMembersByRole(organizationId: string, role: OrganizationRole) {
  return prisma.organizationMembership.count({
    where: { organizationId, role, status: 'ACTIVE' },
  });
}

export async function listRolePermissionKeys(organizationId: string, role: OrganizationRole) {
  const rows = await prisma.rolePermission.findMany({
    where: { organizationId, role },
    select: { permission: true },
  });
  return rows.map((row) => row.permission);
}

export async function replaceRolePermissions(params: {
  organizationId: string;
  role: OrganizationRole;
  permissions: string[];
}) {
  const { organizationId, role, permissions } = params;
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { organizationId, role } });
    if (permissions.length) {
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({ organizationId, role, permission })),
        skipDuplicates: true,
      });
    }
    await bumpOrganizationRoleAccessVersion(organizationId, tx);
  });
}

export async function resetRolePermissionsToOfficial(params: {
  organizationId: string;
  role: OrganizationRole;
  officialPermissions: string[];
}) {
  const { organizationId, role, officialPermissions } = params;
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { organizationId, role } });
    await tx.rolePermission.createMany({
      data: officialPermissions.map((permission) => ({ organizationId, role, permission })),
      skipDuplicates: true,
    });
    await bumpOrganizationRoleAccessVersion(organizationId, tx);
  });
}

export async function findRoleSetting(organizationId: string, role: OrganizationRole) {
  return prisma.roleSetting.findUnique({
    where: { organizationId_role: { organizationId, role } },
  });
}

export async function updateRoleSetting(params: {
  organizationId: string;
  role: OrganizationRole;
  data: {
    displayName: string;
    description: string | null;
    assignable: boolean;
    updatedById: string;
  };
}) {
  const { organizationId, role, data } = params;
  return prisma.roleSetting.update({
    where: { organizationId_role: { organizationId, role } },
    data,
  });
}

export type RoleSettingRow = Prisma.RoleSettingGetPayload<{ select: undefined }>;
