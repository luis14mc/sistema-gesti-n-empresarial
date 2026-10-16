import { prisma } from '@/lib/prisma';
import type { TokenPayload } from '@/lib/auth';
import { canonicalOrganizationId } from '@/platform/security/organization-scope';

/** Rejects tokens of inactive users/memberships or issued before password rotation. */
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

  // NOTE: a stale payload.accessVersion does NOT invalidate the session.
  // accessVersion is bumped whenever role or user permissions change (for every
  // member of the organization when a role matrix is saved). Authorization is
  // always re-evaluated from the database, so a stale token only means the
  // client must refresh its menu/claims (/api/auth/me → tokenStale →
  // /api/auth/refresh-session). Treating it as expired logged everyone out —
  // including the admin who saved the change. Sessions are revoked by
  // passwordChangedAt (below), user deactivation, or membership status.

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
