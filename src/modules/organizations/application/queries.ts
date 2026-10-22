import type { OrganizationStatus, Prisma } from '@prisma/client';
import {
  countOrganizations,
  findOrganizationSummary,
  findOrganizationWithCounts,
  listLifecycleEvents,
  listOrganizationsPage,
} from '@/modules/organizations/infrastructure/organization-repository';

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

export function getCurrentOrganizationSummary(organizationId: string) {
  return findOrganizationSummary(organizationId);
}

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
      listOrganizationsPage(where, (page - 1) * pageSize, pageSize),
      countOrganizations(where),
    ]);
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  },

  async findById(organizationId: string) {
    return findOrganizationWithCounts(organizationId);
  },

  async recentActivity(organizationId: string, take = 20) {
    return listLifecycleEvents(organizationId, take);
  },
};
