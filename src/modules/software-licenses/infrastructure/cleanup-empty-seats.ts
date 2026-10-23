import { prisma } from '@/lib/prisma';

export async function cleanupEmptySeats(confirm: boolean) {
  const candidates = await prisma.softwareLicenseSeat.findMany({
    where: {
      status: { not: 'CANCELLED' },
      accountEmail: null,
      accountIdentifier: null,
      licenseKey: null,
      equipmentId: null,
      assignments: { none: {} },
    },
    include: { subscription: { include: { product: true } } },
  });

  if (!confirm) {
    return { dryRun: true as const, candidates: candidates.map((s) => s.id), updated: 0 };
  }

  if (candidates.length === 0) {
    return { dryRun: false as const, candidates: [], updated: 0 };
  }

  const result = await prisma.softwareLicenseSeat.updateMany({
    where: { id: { in: candidates.map((s) => s.id) } },
    data: { status: 'CANCELLED' },
  });
  return { dryRun: false as const, candidates: candidates.map((s) => s.id), updated: result.count };
}
