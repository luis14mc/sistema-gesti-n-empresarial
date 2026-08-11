import type { Prisma } from '@prisma/client';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { apiFailure } from '@/platform/api/response';

export function equipmentScope(organizationId: string): Prisma.EquipmentWhereInput {
  return { organizationId };
}

export function assignmentScope(organizationId: string): Prisma.EquipmentAssignmentWhereInput {
  return { organizationId, equipment: { organizationId } };
}

export function maintenanceScope(organizationId: string): Prisma.EquipmentMaintenanceWhereInput {
  return { equipment: { organizationId } };
}

export function equipmentApiFailure(error: unknown, requestId: string, fallback: { code: string; message: string; stage: string }) {
  if (isOrganizationContextError(error)) {
    return apiFailure(error.code, 'No fue posible resolver el contexto de organización.', {
      requestId,
      status: error.status,
      details: [],
      stage: 'RESOLVE_ORGANIZATION_CONTEXT',
    });
  }
  return apiFailure(fallback.code, fallback.message, {
    requestId,
    status: 500,
    details: [],
    stage: fallback.stage,
  });
}
