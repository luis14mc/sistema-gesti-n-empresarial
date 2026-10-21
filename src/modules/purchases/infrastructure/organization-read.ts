import { prisma } from '@/lib/prisma';

export async function getOrganizationName(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
}
