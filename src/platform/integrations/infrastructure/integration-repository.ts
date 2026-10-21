import type { IntegrationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type IntegrationListFilters = {
  provider?: string;
  status?: IntegrationStatus;
};

export function listOrganizationIntegrations(
  organizationId: string,
  filters: IntegrationListFilters,
  skip: number,
  take: number,
) {
  const where = {
    organizationId,
    ...(filters.provider ? { provider: filters.provider } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
  return Promise.all([
    prisma.organizationIntegration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.organizationIntegration.count({ where }),
  ]);
}

export function findOrganizationIntegration(organizationId: string, id: string) {
  return prisma.organizationIntegration.findFirst({
    where: { id, organizationId },
  });
}

export function findOrganizationIntegrationId(organizationId: string, id: string) {
  return prisma.organizationIntegration.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
}
