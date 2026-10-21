import type { Prisma } from '@prisma/client';

export function equipmentScope(organizationId: string): Prisma.EquipmentWhereInput {
  return { organizationId };
}

export function assignmentScope(organizationId: string): Prisma.EquipmentAssignmentWhereInput {
  return { organizationId, equipment: { organizationId } };
}

export function maintenanceScope(organizationId: string): Prisma.EquipmentMaintenanceWhereInput {
  return { equipment: { organizationId } };
}
