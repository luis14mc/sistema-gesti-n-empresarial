import type { Role as PrismaUserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromPrismaUserRole, type SessionRole } from '@/platform/security/authorization/roles';

const FALLBACK_ORGANIZATION_ID = 'org_cni_default';

function canonicalOrganizationId(): string {
  return process.env.DEFAULT_ORGANIZATION_ID || FALLBACK_ORGANIZATION_ID;
}

export async function resolveSessionRole(
  userId: string,
  fallback: PrismaUserRole,
): Promise<SessionRole> {
  try {
    const organizationId = canonicalOrganizationId();

    const preferred = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      select: { role: true },
    });

    if (preferred) return preferred.role;

    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      orderBy: { createdAt: 'asc' },
      select: { role: true },
    });

    return membership?.role ?? fromPrismaUserRole(fallback);
  } catch (error) {
    console.error('[session-role] Failed to resolve organization membership role', {
      userId,
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    });

    return fromPrismaUserRole(fallback);
  }
}
