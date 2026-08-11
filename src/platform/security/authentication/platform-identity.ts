import type { PlatformRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type PlatformIdentity = Readonly<{
  authorizationScope: 'platform';
  userId: string;
  role: PlatformRole;
}>;

export async function getPlatformIdentity(userId: string): Promise<PlatformIdentity | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, platformRole: { not: null } },
    select: { id: true, platformRole: true },
  });
  if (!user?.platformRole) return null;
  return { authorizationScope: 'platform', userId: user.id, role: user.platformRole };
}
