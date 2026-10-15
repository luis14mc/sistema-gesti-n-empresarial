import { cache } from 'react';
import type { OrganizationRole as PrismaOrganizationRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  can,
  organizationRole,
  ORGANIZATION_ROLES,
  type OrganizationRole,
  type Permission,
  type RolePermissionCheck,
} from './permissions';
import {
  OFFICIAL_ROLE_PERMISSIONS,
  officialPermissionSetForRole,
} from './official-role-permissions';

export type OrganizationRolePermissionMap = ReadonlyMap<OrganizationRole, ReadonlySet<Permission>>;

function buildMapFromRows(
  rows: Array<{ role: PrismaOrganizationRole; permission: string }>,
): OrganizationRolePermissionMap {
  const map = new Map<OrganizationRole, Set<Permission>>();
  for (const role of ORGANIZATION_ROLES) {
    map.set(role, new Set());
  }
  for (const row of rows) {
    const role = row.role as OrganizationRole;
    const bucket = map.get(role);
    if (bucket) bucket.add(row.permission as Permission);
  }
  return map;
}

export async function loadOrganizationRolePermissionMapUncached(
  organizationId: string,
): Promise<OrganizationRolePermissionMap | null> {
  const rows = await prisma.rolePermission.findMany({
    where: { organizationId },
    select: { role: true, permission: true },
  });
  if (rows.length === 0) return null;
  return buildMapFromRows(rows);
}

export const loadOrganizationRolePermissionMap = cache(loadOrganizationRolePermissionMapUncached);

export function roleHasOrganizationPermission(
  role: OrganizationRole,
  permission: Permission,
  map: OrganizationRolePermissionMap | null,
): boolean {
  if (!map) return can(organizationRole(role), permission);
  return map.get(role)?.has(permission) ?? false;
}

export function createRolePermissionCheck(
  role: OrganizationRole,
  map: OrganizationRolePermissionMap | null,
): RolePermissionCheck {
  return (permission) => roleHasOrganizationPermission(role, permission, map);
}

export function effectivePermissionSetForRole(
  role: OrganizationRole,
  map: OrganizationRolePermissionMap | null,
): ReadonlySet<Permission> {
  if (!map) return officialPermissionSetForRole(role);
  return map.get(role) ?? new Set();
}

export function isRoleMatrixModified(
  role: OrganizationRole,
  map: OrganizationRolePermissionMap | null,
): boolean {
  const official = new Set(OFFICIAL_ROLE_PERMISSIONS[role]);
  const active = effectivePermissionSetForRole(role, map);
  if (official.size !== active.size) return true;
  for (const permission of official) {
    if (!active.has(permission)) return true;
  }
  return false;
}

export function isAnyRoleMatrixModified(map: OrganizationRolePermissionMap | null): boolean {
  if (!map) return false;
  return ORGANIZATION_ROLES.some((role) => isRoleMatrixModified(role, map));
}

export async function bumpOrganizationRoleAccessVersion(
  organizationId: string,
  tx: Pick<typeof prisma, 'organization' | 'organizationMembership'> = prisma,
): Promise<void> {
  await tx.organization.update({
    where: { id: organizationId },
    data: { roleAccessVersion: { increment: 1 } },
  });
  await tx.organizationMembership.updateMany({
    where: { organizationId },
    data: { accessVersion: { increment: 1 } },
  });
}
