import { prisma } from '@/lib/prisma';
import { returnAssignmentInTransaction } from '@/modules/equipment/infrastructure/equipment-repository';
import { closeLicenseAssignmentInTransaction } from '@/modules/software-licenses/infrastructure/close-license-assignment-in-tx';
import { AUDIT_ACTION_EMPLOYEE_DISCHARGE_ACTA } from '@/modules/equipment/domain/acta-texts';

export async function findEmployeeForDischargeActa(organizationId: string, employeeId: string) {
  return prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
    select: {
      id: true,
      fullName: true,
      dni: true,
      position: { select: { name: true } },
    },
  });
}

export async function listActiveEquipmentAssignmentsForDischarge(
  organizationId: string,
  employeeId: string,
) {
  return prisma.equipmentAssignment.findMany({
    where: { employeeId, status: 'ACTIVE', equipment: { organizationId } },
    include: {
      equipment: {
        select: {
          type: true,
          brand: true,
          model: true,
          serialNumber: true,
          includedAccessories: true,
          inventoryCode: true,
        },
      },
    },
  });
}

export async function listOpenPersonalLicenseAssignmentsForDischarge(
  organizationId: string,
  employeeId: string,
) {
  return prisma.licenseAssignment.findMany({
    where: {
      employeeId,
      unassignedAt: null,
      seat: {
        subscription: { organizationId },
        seatType: { in: ['INDIVIDUAL', 'SHARED'] },
      },
    },
    select: { id: true },
  });
}

export async function listLicenseAssignmentsForDischargePrefill(
  organizationId: string,
  employeeId: string,
) {
  return prisma.licenseAssignment.findMany({
    where: { employeeId, unassignedAt: null, seat: { subscription: { organizationId } } },
    include: {
      seat: {
        select: {
          seatType: true,
          accountEmail: true,
          accountIdentifier: true,
          licenseKey: true,
          subscription: { select: { product: { select: { name: true } } } },
        },
      },
    },
  });
}

export async function listDischargeActaAuditRecords(organizationId: string, employeeId: string) {
  return prisma.auditRecord.findMany({
    where: {
      organizationId,
      entityId: employeeId,
      action: AUDIT_ACTION_EMPLOYEE_DISCHARGE_ACTA,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      newData: true,
      description: true,
    },
  });
}

export class DischargeAssetClosureError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DischargeAssetClosureError';
  }
}

/** Devuelve equipos y cierra licencias personales/compartidas en una sola transacción. */
export async function closeEmployeeAssetsForDischargeInTransaction(params: {
  organizationId: string;
  employeeId: string;
  actorUserId: string;
  returnReason: string;
  returnNotes: string;
}) {
  return prisma.$transaction(async (tx) => {
    const equipmentAssignments = await tx.equipmentAssignment.findMany({
      where: {
        employeeId: params.employeeId,
        status: 'ACTIVE',
        equipment: { organizationId: params.organizationId },
      },
      select: { id: true, equipment: { select: { inventoryCode: true } } },
    });

    const closedEquipmentAssignmentIds: string[] = [];

    for (const assignment of equipmentAssignments) {
      try {
        await returnAssignmentInTransaction(
          {
            organizationId: params.organizationId,
            assignmentId: assignment.id,
            returnedById: params.actorUserId,
            finalStatus: 'RETURNED',
            nextEquipmentStatus: 'AVAILABLE',
            returnReason: params.returnReason,
            returnCondition: 'DEVUELTO',
            combinedReturnNotes: params.returnNotes,
          },
          tx,
        );
        closedEquipmentAssignmentIds.push(assignment.id);
      } catch (error) {
        const code = assignment.equipment.inventoryCode ?? assignment.id;
        throw new DischargeAssetClosureError(
          `No se pudo registrar la devolución del equipo ${code}. Ningún cambio fue guardado.`,
          { cause: error },
        );
      }
    }

    const licenseAssignments = await tx.licenseAssignment.findMany({
      where: {
        employeeId: params.employeeId,
        unassignedAt: null,
        seat: {
          subscription: { organizationId: params.organizationId },
          seatType: { in: ['INDIVIDUAL', 'SHARED'] },
        },
      },
      select: { id: true },
    });

    const closedLicenseAssignmentIds: string[] = [];

    for (const licenseAssignment of licenseAssignments) {
      try {
        await closeLicenseAssignmentInTransaction(tx, {
          organizationId: params.organizationId,
          assignmentId: licenseAssignment.id,
          userId: params.actorUserId,
          reason: params.returnReason,
        });
        closedLicenseAssignmentIds.push(licenseAssignment.id);
      } catch (error) {
        throw new DischargeAssetClosureError(
          'No se pudo cerrar una licencia del empleado. Ningún cambio fue guardado.',
          { cause: error },
        );
      }
    }

    return { closedEquipmentAssignmentIds, closedLicenseAssignmentIds };
  });
}
