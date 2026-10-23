import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createAuditRecord } from '@/platform/security/audit/audit-record';

export async function releaseDeviceLicensesForEquipment(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; equipmentId: string; userId: string; requestId?: string },
): Promise<number> {
  const seats = await tx.softwareLicenseSeat.findMany({
    where: {
      equipmentId: input.equipmentId,
      seatType: 'DEVICE',
      status: { not: 'CANCELLED' },
      subscription: { organizationId: input.organizationId },
    },
    include: { subscription: { include: { product: true } } },
  });
  for (const seat of seats) {
    await tx.softwareLicenseSeat.update({
      where: { id: seat.id },
      data: { equipmentId: null },
    });
    await createAuditRecord({
      tx,
      organizationId: input.organizationId,
      userId: input.userId,
      module: 'LICENCIAS',
      category: 'DEVICE_LICENSE_RELEASED',
      action: 'DEVICE_LICENSE_RELEASED',
      title: 'Licencia de equipo liberada',
      description: `${seat.subscription.product.name} · baja de equipo`,
      entityId: seat.id,
      entityType: 'SoftwareLicenseSeat',
      previousData: { equipmentId: input.equipmentId },
      newData: { equipmentId: null },
      requestId: input.requestId,
    });
  }
  return seats.length;
}

export function countActiveDeviceLicensesForEquipment(equipmentId: string, organizationId: string) {
  return prisma.softwareLicenseSeat.count({
    where: {
      equipmentId,
      seatType: 'DEVICE',
      status: { not: 'CANCELLED' },
      subscription: { organizationId },
    },
  });
}
