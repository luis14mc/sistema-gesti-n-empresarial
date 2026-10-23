import { prisma } from '@/lib/prisma';

export async function findEmployeeActiveAssetsDetail(
  organizationId: string,
  employeeId: string,
  options?: { includeLicenses?: boolean },
) {
  const includeLicenses = options?.includeLicenses ?? true;

  const equipmentAssignmentsPromise = prisma.equipmentAssignment.findMany({
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
    });

  const licenseAssignmentsPromise = includeLicenses
    ? prisma.licenseAssignment.findMany({
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
              seatType: true,
              accountEmail: true,
              accountIdentifier: true,
              subscription: {
                select: {
                  id: true,
                  planName: true,
                  monthlyCost: true,
                  totalSeats: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
      })
    : Promise.resolve([]);

  const [equipmentAssignments, licenseAssignments] = await Promise.all([
    equipmentAssignmentsPromise,
    licenseAssignmentsPromise,
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
    licencias: licenseAssignments.map((row) => {
      const monthly = Number(row.seat.subscription.monthlyCost);
      const totalSeats = row.seat.subscription.totalSeats;
      const unitMonthly = totalSeats > 0 ? monthly / totalSeats : 0;
      return {
        assignmentId: row.id,
        subscriptionId: row.seat.subscription.id,
        seatId: row.seat.id,
        producto: row.seat.subscription.product.name,
        plan: row.seat.subscription.planName,
        tipo: row.seat.seatType,
        cuenta: row.seat.accountEmail ?? row.seat.accountIdentifier,
        costoMensualUnitario: unitMonthly,
        asignadoDesde: row.assignedAt.toISOString(),
      };
    }),
  };
}
