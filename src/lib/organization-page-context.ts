import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function requirePageOrganizationId(userId: string): Promise<string> {
  const selectedOrganizationId = (await cookies()).get('organizationId')?.value;
  const memberships = await prisma.organizationMembership.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      organization: { status: 'ACTIVE' },
      ...(selectedOrganizationId ? { organizationId: selectedOrganizationId } : {}),
    },
    select: { organizationId: true },
    take: selectedOrganizationId ? 1 : 2,
  });
  if (memberships.length !== 1) throw new Error('ORGANIZATION_SELECTION_REQUIRED');
  return memberships[0].organizationId;
}
