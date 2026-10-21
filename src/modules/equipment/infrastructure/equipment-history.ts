import type { EquipmentHistoryAction, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface LogEquipmentHistoryParams {
  equipmentId: string;
  action: EquipmentHistoryAction;
  title: string;
  description?: string;
  previousData?: Prisma.InputJsonValue;
  newData?: Prisma.InputJsonValue;
  performedById?: string;
}

export async function logEquipmentHistory(params: LogEquipmentHistoryParams) {
  return prisma.equipmentHistory.create({
    data: {
      equipmentId: params.equipmentId,
      action: params.action,
      title: params.title,
      description: params.description,
      previousData: params.previousData,
      newData: params.newData,
      performedById: params.performedById,
    },
  });
}

export { mapReturnConditionToStatus } from '@/modules/equipment/domain/return-condition';
