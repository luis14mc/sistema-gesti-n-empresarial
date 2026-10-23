import { prisma } from '@/lib/prisma';

export async function resolveInstalledSoftwareLabel(
  organizationId: string,
  equipmentId: string,
  softwareSnapshot: string | null | undefined,
): Promise<string> {
  const parts: string[] = [];
  const snapshot = (softwareSnapshot ?? '').trim();
  if (snapshot) {
    parts.push(
      ...snapshot
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }

  const deviceSeats = await prisma.softwareLicenseSeat.findMany({
    where: {
      equipmentId,
      seatType: 'DEVICE',
      status: { not: 'CANCELLED' },
      subscription: { organizationId },
    },
    select: { subscription: { select: { product: { select: { name: true } } } } },
  });

  for (const seat of deviceSeats) {
    const name = seat.subscription.product.name.trim();
    if (name && !parts.some((p) => p.toLowerCase() === name.toLowerCase())) {
      parts.push(name);
    }
  }

  return parts.length > 0 ? parts.join(', ') : '—';
}
