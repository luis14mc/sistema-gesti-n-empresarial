import { prisma } from '@/lib/prisma';

export async function findUserEmailById(userId: string): Promise<string | null | undefined> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user?.email;
}
