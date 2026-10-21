import { prisma } from '@/lib/prisma';

export async function listActiveCostCenters(organizationId: string) {
  return prisma.costCenter.findMany({
    where: { organizationId, isActive: true },
    orderBy: { code: 'asc' },
  });
}
