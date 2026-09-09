import type { Role as PrismaUserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromPrismaUserRole, type SessionRole } from '@/platform/security/authorization/roles';

export async function resolveSessionRole(userId: string, fallback: PrismaUserRole): Promise<SessionRole> {
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId, status: 'ACTIVE', organization: { status: 'ACTIVE' } },
    orderBy: { createdAt: 'asc' },
    select: { role: true },
  });
  return membership?.role ?? fromPrismaUserRole(fallback);
}
