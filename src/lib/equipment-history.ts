import type { EquipmentHistoryAction, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

interface LogEquipmentHistoryParams {
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

/** Mapea condición de devolución al estado del equipo */
export function mapReturnConditionToStatus(
  returnCondition?: string,
  equipmentStatusAfter?: string
): 'AVAILABLE' | 'IN_MAINTENANCE' | 'DAMAGED' | 'RETIRED' | 'LOST' {
  if (equipmentStatusAfter) {
    const allowed = ['AVAILABLE', 'IN_MAINTENANCE', 'DAMAGED', 'RETIRED', 'LOST'];
    if (allowed.includes(equipmentStatusAfter)) {
      return equipmentStatusAfter as 'AVAILABLE' | 'IN_MAINTENANCE' | 'DAMAGED' | 'RETIRED' | 'LOST';
    }
  }

  const condition = (returnCondition || '').toUpperCase();
  if (condition.includes('MANTENIMIENTO') || condition === 'IN_MAINTENANCE') return 'IN_MAINTENANCE';
  if (condition.includes('DAÑ') || condition.includes('DAN') || condition === 'DAMAGED') return 'DAMAGED';
  if (condition.includes('BAJA') || condition.includes('RETIR') || condition === 'RETIRED') return 'RETIRED';
  if (condition.includes('EXTRAV') || condition.includes('PERD') || condition === 'LOST') return 'LOST';
  return 'AVAILABLE';
}
