import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { NotificationRecipient } from '../domain/rules';

export type ResolvedRecipient = Readonly<{
  userId: string;
  email: string;
  isActive: boolean;
}>;

const ROLE_ADMIN: NotificationRecipient = { kind: 'organization-role', role: 'ADMIN' };
const ROLE_OWNER: NotificationRecipient = { kind: 'organization-role', role: 'OWNER' };

function isRecipientRole(recipient: NotificationRecipient, role: 'OWNER' | 'ADMIN'): boolean {
  return (recipient.kind === 'organization-role' && recipient.role === role)
    || (recipient.kind === 'organization-owners' && role === 'OWNER')
    || (recipient.kind === 'organization-admins' && role === 'ADMIN');
}

export async function resolveRecipients(
  organizationId: string,
  recipients: readonly NotificationRecipient[],
  options: { excludeUserIds?: ReadonlySet<string>; tx?: Prisma.TransactionClient } = {},
): Promise<ResolvedRecipient[]> {
  const tx = options.tx ?? prisma;
  const includeOwners = recipients.some((recipient) => isRecipientRole(recipient, 'OWNER'));
  const includeAdmins = recipients.some((recipient) => isRecipientRole(recipient, 'ADMIN'));
  const includeSpecific = recipients.filter((r) => r.kind === 'specific-users' && r.userIds?.length);
  const specificUserIds = includeSpecific.flatMap((r) => r.userIds ?? []);

  const roles: ('OWNER' | 'ADMIN')[] = [];
  if (includeOwners) roles.push('OWNER');
  if (includeAdmins) roles.push('ADMIN');

  const where: Prisma.OrganizationMembershipWhereInput = {
    organizationId,
    status: 'ACTIVE',
    user: { isActive: true },
  };
  if (roles.length > 0) where.role = { in: roles };
  if (specificUserIds.length > 0) where.userId = { in: specificUserIds };

  const memberships = await tx.organizationMembership.findMany({
    where,
    select: {
      userId: true,
      user: { select: { email: true, isActive: true } },
    },
  });

  const seen = new Set<string>();
  const results: ResolvedRecipient[] = [];
  for (const membership of memberships) {
    if (!membership.user.isActive) continue;
    if (options.excludeUserIds?.has(membership.userId)) continue;
    if (seen.has(membership.userId)) continue;
    seen.add(membership.userId);
    results.push({
      userId: membership.userId,
      email: membership.user.email,
      isActive: true,
    });
  }
  return results;
}

export async function resolveOrganizationOwners(
  organizationId: string,
  options?: { tx?: Prisma.TransactionClient },
): Promise<ResolvedRecipient[]> {
  return resolveRecipients(organizationId, [ROLE_OWNER], options);
}

export async function resolveOrganizationAdmins(
  organizationId: string,
  options?: { tx?: Prisma.TransactionClient },
): Promise<ResolvedRecipient[]> {
  return resolveRecipients(organizationId, [ROLE_ADMIN], options);
}
