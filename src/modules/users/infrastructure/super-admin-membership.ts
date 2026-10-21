import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@/platform/security/authorization/permissions';

/** Membership roles treated as Super Admin for org safety guards. */
export const SUPER_ADMIN_MEMBERSHIP_ROLES = ['OWNER', 'ADMIN'] as const satisfies readonly OrganizationRole[];

export async function countActiveSuperAdminMemberships(
  organizationId: string,
  excludeUserId?: string,
): Promise<number> {
  return prisma.organizationMembership.count({
    where: {
      organizationId,
      status: 'ACTIVE',
      role: { in: [...SUPER_ADMIN_MEMBERSHIP_ROLES] },
      user: { isActive: true },
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
  });
}

export function isSuperAdminMembershipRole(role: OrganizationRole): boolean {
  return (SUPER_ADMIN_MEMBERSHIP_ROLES as readonly string[]).includes(role);
}
