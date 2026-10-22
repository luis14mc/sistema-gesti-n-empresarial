import type { OrganizationRole, PermissionEffect } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PermissionDeniedError } from '@/platform/domain/errors';
import {
  canWithOverrides,
  ORGANIZATION_PERMISSIONS,
  organizationRole,
  type Permission,
  type PermissionOverride,
} from './permissions';
import {
  createRolePermissionCheck,
  loadOrganizationRolePermissionMap,
} from './role-permission-service';

export async function canForOrganization(
  userId: string,
  organizationId: string,
  role: OrganizationRole,
  permission: Permission,
): Promise<boolean> {
  const [overrides, roleMap] = await Promise.all([
    prisma.userPermissionOverride.findMany({
      where: { userId, organizationId, permission },
      select: { permission: true, effect: true },
    }),
    loadOrganizationRolePermissionMap(organizationId),
  ]);

  const roleHas = createRolePermissionCheck(role, roleMap);

  return canWithOverrides(
    organizationRole(role),
    permission,
    overrides as PermissionOverride[],
    roleHas,
  );
}

export async function requireOrganizationPermission(
  userId: string,
  organizationId: string,
  role: OrganizationRole,
  permission: Permission,
): Promise<void> {
  const allowed = await canForOrganization(userId, organizationId, role, permission);
  if (!allowed) {
    throw new PermissionDeniedError('No tiene permiso para realizar esta operación.', {
      permission,
      scope: 'organization',
    });
  }
}

export async function listEffectivePermissionsForMember(
  userId: string,
  organizationId: string,
  role: OrganizationRole,
): Promise<Permission[]> {
  return listEffectiveOrganizationPermissions(userId, organizationId, role);
}

export async function listEffectiveOrganizationPermissions(
  userId: string,
  organizationId: string,
  role: OrganizationRole,
): Promise<Permission[]> {
  const granted = await getEffectiveOrganizationPermissions(
    userId,
    organizationId,
    role,
    ORGANIZATION_PERMISSIONS,
  );
  return [...granted];
}

export async function getEffectiveOrganizationPermissions(
  userId: string,
  organizationId: string,
  role: OrganizationRole,
  permissions: readonly Permission[],
): Promise<ReadonlySet<Permission>> {
  const [overrides, roleMap] = await Promise.all([
    prisma.userPermissionOverride.findMany({
      where: { userId, organizationId },
      select: { permission: true, effect: true },
    }),
    loadOrganizationRolePermissionMap(organizationId),
  ]);
  const typedOverrides = overrides as Array<PermissionOverride & { effect: PermissionEffect }>;
  const roleHas = createRolePermissionCheck(role, roleMap);

  return new Set(
    permissions.filter((permission) =>
      canWithOverrides(organizationRole(role), permission, typedOverrides, roleHas),
    ),
  );
}
