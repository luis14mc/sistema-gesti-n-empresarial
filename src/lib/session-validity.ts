import { prisma } from '@/lib/prisma';
import type { TokenPayload } from '@/lib/auth';
import { canonicalOrganizationId } from '@/platform/security/organization-scope';

/** Rejects tokens issued before password rotation or after accessVersion bump. */
export async function assertTokenSessionStillValid(payload: TokenPayload): Promise<boolean> {
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isActive: true, passwordChangedAt: true },
    }),
    prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: canonicalOrganizationId(),
          userId: payload.userId,
        },
      },
      select: { accessVersion: true, status: true },
    }),
  ]);

  if (!user?.isActive || membership?.status !== 'ACTIVE') {
    return false;
  }

  if (
    payload.accessVersion !== undefined &&
    membership &&
    payload.accessVersion !== membership.accessVersion
  ) {
    return false;
  }

  if (user.passwordChangedAt && payload.iat !== undefined) {
    const issuedAtMs = payload.iat * 1000;
    if (issuedAtMs < user.passwordChangedAt.getTime()) {
      return false;
    }
  }

  if (
    payload.pwdChangedAtMs !== undefined &&
    user.passwordChangedAt &&
    user.passwordChangedAt.getTime() > payload.pwdChangedAtMs
  ) {
    return false;
  }

  return true;
}
