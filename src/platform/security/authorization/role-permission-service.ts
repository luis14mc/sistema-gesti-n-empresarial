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
import { lockedPermissionsForRole } from './role-permission-locks';

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

function rolePermissionSetFromMap(
  role: OrganizationRole,
  map: OrganizationRolePermissionMap | null,
): ReadonlySet<Permission> | null {
  if (!map) return null;
  const fromDb = map.get(role);
  if (!fromDb || fromDb.size === 0) return null;
  return fromDb;
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

/** Always reads from DB — do not wrap in React cache (stale matrices after PUT). */
export const loadOrganizationRolePermissionMap = loadOrganizationRolePermissionMapUncached;

export function roleHasOrganizationPermission(
  role: OrganizationRole,
  permission: Permission,
  map: OrganizationRolePermissionMap | null,
): boolean {
  if (lockedPermissionsForRole(role).includes(permission)) {
    return true;
  }
  const roleSet = rolePermissionSetFromMap(role, map);
  if (!roleSet) return can(organizationRole(role), permission);
  return roleSet.has(permission);
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
  const roleSet = rolePermissionSetFromMap(role, map);
  if (!roleSet) return officialPermissionSetForRole(role);
  return roleSet;
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
