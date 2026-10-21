import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  assignmentScope,
  equipmentScope,
  maintenanceScope,
} from '@/modules/equipment/application/tenant';

const assignmentInclude = {
  equipment: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  employee: {
    select: {
      id: true,
      fullName: true,
      email: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
    },
  },
} as const;

export async function findEmployeeByUserId(userId: string) {
  return prisma.employee.findFirst({ where: { userId } });
}

export async function listEquipmentRows(
  where: Prisma.EquipmentWhereInput,
  skip: number,
  take: number,
) {
  return prisma.equipment.findMany({
    where,
    skip,
    take,
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          employee: {
            select: {
              id: true,
              fullName: true,
              email: true,
              department: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { inventoryCode: 'asc' },
  });
}

export async function countEquipment(where: Prisma.EquipmentWhereInput) {
  return prisma.equipment.count({ where });
}

export async function getEquipmentById(id: string, organizationId: string) {
  return prisma.equipment.findFirst({
    where: { id, organizationId },
    include: {
      assignments: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          employee: {
            select: {
              id: true,
              fullName: true,
              email: true,
              department: { select: { name: true } },
              position: { select: { name: true } },
            },
          },
        },
        orderBy: { assignedDate: 'desc' },
      },
      maintenances: { orderBy: { createdAt: 'desc' } },
      history: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
}

export async function findEquipmentForUpdate(id: string, organizationId: string) {
  return prisma.equipment.findFirst({ where: { id, organizationId } });
}

export async function updateEquipmentRecord(
  id: string,
  organizationId: string,
  data: Prisma.EquipmentUpdateInput,
) {
  return prisma.equipment.update({
    where: { id, organizationId },
    data,
  });
}

export async function findOrganizationName(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
}

export async function loadEquipmentStats(organizationId: string) {
  const scoped = equipmentScope(organizationId);
  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  return Promise.all([
    prisma.equipment.count({ where: scoped }),
    prisma.equipment.count({ where: { ...scoped, status: 'AVAILABLE' } }),
    prisma.equipment.count({ where: { ...scoped, status: 'ASSIGNED' } }),
    prisma.equipment.count({ where: { ...scoped, status: 'IN_MAINTENANCE' } }),
    prisma.equipment.count({ where: { ...scoped, status: 'DAMAGED' } }),
    prisma.equipment.count({ where: { ...scoped, status: 'RETIRED' } }),
    prisma.equipment.count({ where: { ...scoped, status: 'LOST' } }),
    prisma.equipment.count({ where: { ...scoped, OR: [{ serialNumber: null }, { serialNumber: '' }] } }),
    prisma.equipment.count({
      where: {
        ...scoped,
        warrantyDate: { gte: now, lte: in30Days },
        status: { not: 'RETIRED' },
      },
    }),
    prisma.equipment.groupBy({
      by: ['category'],
      _count: { _all: true },
      where: { ...scoped, status: { not: 'RETIRED' } },
    }),
    prisma.equipmentAssignment.groupBy({
      by: ['departmentAtTime'],
      _count: { _all: true },
      where: { ...assignmentScope(organizationId), status: 'ACTIVE', departmentAtTime: { not: null } },
    }),
  ]);
}

export async function listAssignments(
  where: Prisma.EquipmentAssignmentWhereInput,
  skip: number,
  take: number,
) {
  return prisma.equipmentAssignment.findMany({
    where,
    skip,
    take,
    include: assignmentInclude,
    orderBy: { assignedDate: 'desc' },
  });
}

export async function countAssignments(where: Prisma.EquipmentAssignmentWhereInput) {
  return prisma.equipmentAssignment.count({ where });
}

export async function findAssignmentById(id: string, organizationId: string) {
  return prisma.equipmentAssignment.findFirst({
    where: { id, ...assignmentScope(organizationId) },
    include: { equipment: true },
  });
}

export async function findAssignmentWithRelations(id: string, organizationId: string) {
  return prisma.equipmentAssignment.findFirst({
    where: { id, ...assignmentScope(organizationId) },
    include: assignmentInclude,
  });
}

export async function findActiveAssignmentForSwap(oldAssignmentId: string, organizationId: string) {
  return prisma.equipmentAssignment.findFirst({
    where: { id: oldAssignmentId, ...assignmentScope(organizationId) },
    include: { equipment: true, employee: true, user: true },
  });
}

export type AssignEquipmentSnapshot = {
  employeeId: string | null;
  departmentAtTime: string | null;
  positionAtTime: string | null;
  employeeEmailAtTime: string | null;
  employeeNameAtTime: string;
};

export async function assignEquipmentInTransaction(params: {
  organizationId: string;
  equipmentId: string;
  userId: string;
  assignedById: string;
  snapshot: AssignEquipmentSnapshot;
  deliveryReason?: string;
  combinedNotes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const equipment = await tx.equipment.findFirst({
      where: { id: params.equipmentId, organizationId: params.organizationId },
      include: {
        assignments: { where: { status: 'ACTIVE' } },
        disposals: { where: { status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] } }, select: { id: true } },
      },
    });

    if (!equipment) throw new Error('NOT_FOUND');
    if (equipment.status !== 'AVAILABLE') throw new Error('NOT_AVAILABLE');
    if (equipment.disposals.length > 0) throw new Error('DISPOSAL_IN_PROGRESS');
    if (equipment.assignments.length > 0) throw new Error('ALREADY_ASSIGNED');

    const assignment = await tx.equipmentAssignment.create({
      data: {
        equipmentId: params.equipmentId,
        organizationId: params.organizationId,
        employeeId: params.snapshot.employeeId,
        userId: params.userId || undefined,
        assignedById: params.assignedById,
        status: 'ACTIVE',
        departmentAtTime: params.snapshot.departmentAtTime,
        positionAtTime: params.snapshot.positionAtTime,
        employeeEmailAtTime: params.snapshot.employeeEmailAtTime,
        employeeNameAtTime: params.snapshot.employeeNameAtTime,
        employeeNameSnapshot: params.snapshot.employeeNameAtTime,
        departmentSnapshot: params.snapshot.departmentAtTime,
        positionSnapshot: params.snapshot.positionAtTime,
        inventoryNumberSnapshot: equipment.inventoryCode,
        brandSnapshot: equipment.brand,
        modelSnapshot: equipment.model,
        serialNumberSnapshot: equipment.serialNumber,
        ramSnapshot: equipment.ram,
        processorSnapshot: equipment.processor,
        storageSnapshot: equipment.storage,
        operatingSystemSnapshot: equipment.os,
        accessoriesSnapshot: equipment.includedAccessories,
        softwareSnapshot: equipment.installedSoftware,
        deliveryReason: params.deliveryReason,
        assignmentNotes: params.combinedNotes || undefined,
        notes: params.combinedNotes || undefined,
      },
      include: assignmentInclude,
    });

    await tx.equipment.update({
      where: { id: params.equipmentId },
      data: { status: 'ASSIGNED' },
    });

    return assignment;
  });
}

export async function returnAssignmentInTransaction(params: {
  organizationId: string;
  assignmentId: string;
  returnedById: string;
  finalStatus: 'RETURNED' | 'REPLACED';
  nextEquipmentStatus: string;
  returnReason?: string;
  returnCondition?: string;
  combinedReturnNotes?: string;
  notes?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.equipmentAssignment.findFirst({
      where: { id: params.assignmentId, ...assignmentScope(params.organizationId) },
      include: { equipment: true },
    });
    if (!assignment) throw new Error('NOT_FOUND');

    const updatedAssignment = await tx.equipmentAssignment.update({
      where: { id: params.assignmentId, equipment: { organizationId: params.organizationId } },
      data: {
        status: params.finalStatus,
        returnedDate: new Date(),
        returnedById: params.returnedById,
        returnReason: params.returnReason || params.returnCondition,
        returnCondition: params.returnCondition,
        returnNotes: params.combinedReturnNotes || undefined,
        notes: params.combinedReturnNotes || assignment.notes,
      },
      include: assignmentInclude,
    });

    await tx.equipment.update({
      where: { id: assignment.equipmentId, organizationId: params.organizationId },
      data: { status: params.nextEquipmentStatus as 'AVAILABLE' | 'IN_MAINTENANCE' | 'DAMAGED' | 'RETIRED' | 'LOST' },
    });

    return { updatedAssignment, previousEquipmentStatus: assignment.equipment.status, equipmentCode: assignment.equipment.inventoryCode, equipmentId: assignment.equipmentId };
  });
}

export async function swapAssignmentInTransaction(params: {
  organizationId: string;
  oldAssignmentId: string;
  newEquipmentId: string;
  assignedById: string;
  returnedById: string;
  snapshot: AssignEquipmentSnapshot;
  resolvedUserId?: string;
  nextOldStatus: string;
  returnReason?: string;
  returnCondition?: string;
  deliveryReason?: string;
  /** Notas en la asignación cerrada (solo `assignmentNotes` del body, sin accesorios). */
  closedReturnNotes?: string;
  /** Notas en la asignación nueva (notas + línea de accesorios si aplica). */
  newAssignmentNotes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const newEquipment = await tx.equipment.findFirst({
      where: { id: params.newEquipmentId, organizationId: params.organizationId },
      include: { assignments: { where: { status: 'ACTIVE' } } },
    });

    if (!newEquipment) throw new Error('NEW_NOT_FOUND');
    if (newEquipment.status !== 'AVAILABLE' || newEquipment.assignments.length > 0) {
      throw new Error('NEW_NOT_AVAILABLE');
    }

    const oldAssignment = await tx.equipmentAssignment.findFirst({
      where: { id: params.oldAssignmentId, ...assignmentScope(params.organizationId) },
    });
    if (!oldAssignment || oldAssignment.status !== 'ACTIVE') throw new Error('OLD_NOT_ACTIVE');

    const closedAssignment = await tx.equipmentAssignment.update({
      where: { id: params.oldAssignmentId },
      data: {
        status: 'REPLACED',
        returnedDate: new Date(),
        returnedById: params.returnedById,
        returnReason: params.returnReason || 'Cambio de equipo',
        returnCondition: params.returnCondition,
        returnNotes: params.closedReturnNotes,
      },
      include: { equipment: true },
    });

    await tx.equipment.update({
      where: { id: oldAssignment.equipmentId },
      data: { status: params.nextOldStatus as 'AVAILABLE' | 'IN_MAINTENANCE' | 'DAMAGED' | 'RETIRED' | 'LOST' },
    });

    const newAssignment = await tx.equipmentAssignment.create({
      data: {
        equipmentId: params.newEquipmentId,
        organizationId: params.organizationId,
        employeeId: params.snapshot.employeeId,
        userId: params.resolvedUserId,
        assignedById: params.assignedById,
        status: 'ACTIVE',
        departmentAtTime: params.snapshot.departmentAtTime,
        positionAtTime: params.snapshot.positionAtTime,
        employeeEmailAtTime: params.snapshot.employeeEmailAtTime,
        employeeNameAtTime: params.snapshot.employeeNameAtTime,
        deliveryReason: params.deliveryReason || 'Cambio de equipo',
        assignmentNotes: params.newAssignmentNotes || undefined,
      },
      include: {
        equipment: true,
        employee: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await tx.equipment.update({
      where: { id: params.newEquipmentId },
      data: { status: 'ASSIGNED' },
    });

    return { closedAssignment, newAssignment, oldEquipmentId: oldAssignment.equipmentId };
  });
}

export async function updateAssignmentDocument(params: {
  organizationId: string;
  assignmentId: string;
  updateData: { returnDocumentUrl?: string; deliveryDocumentUrl?: string; urlNotaPdf?: string };
}) {
  return prisma.equipmentAssignment.update({
    where: { id: params.assignmentId, equipment: { organizationId: params.organizationId } },
    data: params.updateData,
    include: assignmentInclude,
  });
}

export async function listMaintenances(
  where: Prisma.EquipmentMaintenanceWhereInput,
  skip: number,
  take: number,
) {
  return prisma.equipmentMaintenance.findMany({
    where,
    skip,
    take,
    include: {
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
    orderBy: { createdAt: 'desc' },
  });
}

export async function countMaintenances(where: Prisma.EquipmentMaintenanceWhereInput) {
  return prisma.equipmentMaintenance.count({ where });
}

export async function findMaintenanceById(id: string, organizationId: string) {
  return prisma.equipmentMaintenance.findFirst({
    where: { id, ...maintenanceScope(organizationId) },
    include: {
      equipment: {
        select: {
          id: true,
          inventoryCode: true,
          brand: true,
          model: true,
          type: true,
          serialNumber: true,
        },
      },
    },
  });
}

export async function findMaintenanceRecord(id: string, organizationId: string) {
  return prisma.equipmentMaintenance.findFirst({
    where: { id, ...maintenanceScope(organizationId) },
  });
}

export async function createMaintenanceInTransaction(params: {
  organizationId: string;
  performedById: string;
  data: {
    equipmentId: string;
    type: string;
    description: string;
    scheduledDate: Date | null;
    completedDate: Date | null;
    cost: Prisma.Decimal | null;
    technician: string | null;
    notes: string | null;
    status: string;
  };
  setsEquipmentInMaintenance: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const equipment = await tx.equipment.findFirst({
      where: { id: params.data.equipmentId, organizationId: params.organizationId },
      include: {
        assignments: { where: { status: 'ACTIVE' }, take: 1, select: { id: true } },
      },
    });

    if (!equipment) {
      throw Object.assign(new Error('EQUIPMENT_NOT_FOUND'), { status: 404 });
    }

    if (params.setsEquipmentInMaintenance && equipment.assignments.length > 0) {
      throw Object.assign(new Error('EQUIPMENT_HAS_ACTIVE_ASSIGNMENT'), {
        status: 409,
        meta: { activeAssignmentId: equipment.assignments[0].id },
      });
    }

    if (
      params.setsEquipmentInMaintenance
      && ['DISPOSED', 'RETIRED', 'LOST'].includes(equipment.status)
    ) {
      throw Object.assign(new Error('EQUIPMENT_NOT_ELIGIBLE_FOR_MAINTENANCE'), {
        status: 409,
        meta: { currentStatus: equipment.status },
      });
    }

    const maintenance = await tx.equipmentMaintenance.create({
      data: {
        equipmentId: params.data.equipmentId,
        type: params.data.type as Prisma.EnumMaintenanceTypeFieldUpdateOperationsInput['set'],
        description: params.data.description,
        scheduledDate: params.data.scheduledDate,
        completedDate: params.data.completedDate,
        cost: params.data.cost,
        technician: params.data.technician,
        notes: params.data.notes,
        status: params.data.status as Prisma.EnumMaintenanceStatusFieldUpdateOperationsInput['set'],
        performedById: params.performedById,
      },
      include: {
        equipment: {
          select: { id: true, inventoryCode: true, brand: true, model: true },
        },
      },
    });

    if (params.setsEquipmentInMaintenance) {
      await tx.equipment.update({
        where: { id: params.data.equipmentId, organizationId: params.organizationId },
        data: { status: 'IN_MAINTENANCE' },
      });
    }

    return maintenance;
  });
}

export async function updateMaintenanceInTransaction(params: {
  organizationId: string;
  maintenanceId: string;
  updateData: Prisma.EquipmentMaintenanceUpdateInput;
  wasActive: boolean;
  isNowActive: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.equipmentMaintenance.update({
      where: { id: params.maintenanceId, equipment: { organizationId: params.organizationId } },
      data: params.updateData,
      include: {
        equipment: { select: { id: true, inventoryCode: true, brand: true, model: true } },
      },
    });

    if (params.wasActive && !params.isNowActive) {
      await tx.equipment.update({
        where: { id: updated.equipmentId, organizationId: params.organizationId },
        data: { status: 'AVAILABLE' },
      });
    } else if (!params.wasActive && params.isNowActive) {
      await tx.equipment.update({
        where: { id: updated.equipmentId, organizationId: params.organizationId },
        data: { status: 'IN_MAINTENANCE' },
      });
    }

    return updated;
  });
}

export async function deleteMaintenance(id: string, organizationId: string) {
  return prisma.equipmentMaintenance.delete({
    where: { id, equipment: { organizationId } },
  });
}
