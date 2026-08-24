import type { OrganizationRole, PermissionEffect } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  canWithOverrides,
  organizationRole,
  type Permission,
  type PermissionOverride,
} from './permissions';

export async function canForOrganization(
  userId: string,
  organizationId: string,
  role: OrganizationRole,
  permission: Permission,
): Promise<boolean> {
  const overrides = await prisma.userPermissionOverride.findMany({
    where: { userId, organizationId, permission },
    select: { permission: true, effect: true },
  });

  return canWithOverrides(
    organizationRole(role),
    permission,
    overrides as PermissionOverride[],
  );
}

export async function getEffectiveOrganizationPermissions(
  userId: string,
  organizationId: string,
  role: OrganizationRole,
  permissions: readonly Permission[],
): Promise<ReadonlySet<Permission>> {
  const overrides = await prisma.userPermissionOverride.findMany({
    where: { userId, organizationId },
    select: { permission: true, effect: true },
  });
  const typedOverrides = overrides as Array<PermissionOverride & { effect: PermissionEffect }>;

  return new Set(
    permissions.filter((permission) => canWithOverrides(organizationRole(role), permission, typedOverrides)),
  );
}
