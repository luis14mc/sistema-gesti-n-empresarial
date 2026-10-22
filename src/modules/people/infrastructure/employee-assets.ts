import { prisma } from '@/lib/prisma';

export async function findEmployeeActiveAssetsDetail(organizationId: string, employeeId: string) {
  const [equipmentAssignments, licenseAssignments] = await Promise.all([
    prisma.equipmentAssignment.findMany({
      where: {
        employeeId,
        status: 'ACTIVE',
        equipment: { organizationId },
      },
      orderBy: { assignedDate: 'desc' },
      select: {
        id: true,
        assignedDate: true,
        deliveryDocumentUrl: true,
        urlNotaPdf: true,
        equipment: {
          select: {
            id: true,
            inventoryCode: true,
            brand: true,
            model: true,
            type: true,
          },
        },
      },
    }),
    prisma.licenseAssignment.findMany({
      where: {
        employeeId,
        unassignedAt: null,
        seat: { subscription: { organizationId } },
      },
      orderBy: { assignedAt: 'desc' },
      select: {
        id: true,
        assignedAt: true,
        seat: {
          select: {
            id: true,
            accountEmail: true,
            accountIdentifier: true,
            subscription: {
              select: {
                id: true,
                planName: true,
                product: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    equipos: equipmentAssignments.map((row) => ({
      assignmentId: row.id,
      equipmentId: row.equipment.id,
      codigo: row.equipment.inventoryCode,
      nombre: [row.equipment.brand, row.equipment.model].filter(Boolean).join(' ') || row.equipment.type,
      asignadoDesde: row.assignedDate.toISOString(),
      actaEntregaUrl: row.deliveryDocumentUrl ?? row.urlNotaPdf,
    })),
    licencias: licenseAssignments.map((row) => ({
      assignmentId: row.id,
      subscriptionId: row.seat.subscription.id,
      seatId: row.seat.id,
      producto: row.seat.subscription.product.name,
      plan: row.seat.subscription.planName,
      cuenta: row.seat.accountEmail ?? row.seat.accountIdentifier,
      asignadoDesde: row.assignedAt.toISOString(),
    })),
  };
}
