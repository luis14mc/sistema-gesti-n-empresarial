import type { OrganizationStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type OrganizationListQuery = Readonly<{
  status?: OrganizationStatus;
  search?: string;
  page: number;
  pageSize: number;
}>;

export type OrganizationListItem = Prisma.OrganizationGetPayload<{
  select: {
    id: true;
    name: true;
    slug: true;
    status: true;
    onboardingStatus: true;
    timezone: true;
    locale: true;
    currency: true;
    legalName: true;
    rtn: true;
    createdAt: true;
    updatedAt: true;
    activatedAt: true;
    suspendedAt: true;
    archivedAt: true;
    deletionRequestedAt: true;
  };
}> & {
  _count: { memberships: number };
};

export const organizationPlatformQueryService = {
  async list(query: OrganizationListQuery) {
    const page = Number.isSafeInteger(query.page) && query.page > 0 ? query.page : 1;
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);
    const where: Prisma.OrganizationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search.toLowerCase(), mode: 'insensitive' } },
              { legalName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
      }),
      prisma.organization.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  },

  async findById(organizationId: string) {
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
  },

  async recentActivity(organizationId: string, take = 20) {
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
  },
};
