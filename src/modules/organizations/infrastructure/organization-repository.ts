import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { appendSecurityEvent } from '@/platform/security/audit/security-events';

export function findActiveUserIdentity(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { id: true, email: true },
  });
}

export function listMembershipsWithOrganization(userId: string) {
  return prisma.organizationMembership.findMany({
    where: { userId },
    // Keep authorization independent from optional lifecycle columns. Older
    // CNI databases may not yet have `organizations.timezone`; it is not part
    // of the tenant boundary or permission decision.
    include: { organization: { select: { id: true, slug: true, status: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export function findActivePlatformUser(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, isActive: true, platformRole: { not: null } },
    select: { id: true, email: true, platformRole: true },
  });
}

export function findOrganizationSummary(organizationId: string) {
  return prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, slug: true, name: true, logoKey: true, timezone: true } });
}

export function listOrganizationsPage(where: Prisma.OrganizationWhereInput, skip: number, take: number) {
  return prisma.organization.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      onboardingStatus: true,
      timezone: true,
      locale: true,
      currency: true,
      legalName: true,
      rtn: true,
      createdAt: true,
      updatedAt: true,
      activatedAt: true,
      suspendedAt: true,
      archivedAt: true,
      deletionRequestedAt: true,
      _count: { select: { memberships: true } },
    },
  });
}

export function countOrganizations(where: Prisma.OrganizationWhereInput) {
  return prisma.organization.count({ where });
}

export function findOrganizationWithCounts(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      _count: {
        select: {
          memberships: true,
          equipment: true,
          purchaseOrders: true,
          oficios: true,
          audits: true,
        },
      },
    },
  });
}

export function listLifecycleEvents(organizationId: string, take: number) {
  return prisma.systemAuditEvent.findMany({
    where: {
      organizationId,
      eventType: { startsWith: 'organization.lifecycle.' },
    },
    orderBy: { occurredAt: 'desc' },
    take,
    select: {
      id: true,
      eventType: true,
      outcome: true,
      severity: true,
      action: true,
      reasonCode: true,
      attributes: true,
      occurredAt: true,
      userId: true,
      requestId: true,
    },
  });
}

/** Operaciones disponibles dentro de una transacción del ciclo de vida de la organización. */
export type OrganizationLifecycleStore = {
  create(data: Prisma.OrganizationCreateInput): ReturnType<Prisma.TransactionClient['organization']['create']>;
  find(organizationId: string): ReturnType<typeof findOrganizationInTx>;
  update(organizationId: string, data: Prisma.OrganizationUpdateInput): ReturnType<Prisma.TransactionClient['organization']['update']>;
  countActiveOwners(organizationId: string): Promise<number>;
  appendEvent(event: Parameters<typeof appendSecurityEvent>[1]): Promise<unknown>;
};

function findOrganizationInTx(tx: Prisma.TransactionClient, organizationId: string) {
  return tx.organization.findUnique({ where: { id: organizationId } });
}

export function runOrganizationLifecycleTransaction<T>(work: (store: OrganizationLifecycleStore) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => work({
    create: (data) => tx.organization.create({ data }),
    find: (organizationId) => findOrganizationInTx(tx, organizationId),
    update: (organizationId, data) => tx.organization.update({ where: { id: organizationId }, data }),
    countActiveOwners: (organizationId) => tx.organizationMembership.count({
      where: { organizationId, role: 'OWNER', status: 'ACTIVE' },
    }),
    appendEvent: (event) => appendSecurityEvent(tx, event),
  }));
}
