import { Prisma } from '@prisma/client';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { logEquipmentHistory } from '@/modules/equipment/infrastructure/equipment-history';
import {
  countMaintenances,
  createMaintenanceInTransaction,
  deleteMaintenance,
  findMaintenanceById,
  findMaintenanceRecord,
  listMaintenances,
  updateMaintenanceInTransaction,
} from '@/modules/equipment/infrastructure/equipment-repository';
import { maintenanceScope } from '@/modules/equipment/application/tenant';
import { equipmentDocumentKeyFromUrl } from '@/modules/equipment/infrastructure/equipment-document-access';
import { removeStoredDocument } from '@/modules/purchases/infrastructure/purchase-order-document-access';
import {
  maintenanceCreateSchema,
  maintenanceUpdateSchema,
  VALID_MAINTENANCE_TRANSITIONS,
  MAINTENANCE_STATUSES,
} from '@/modules/equipment/presentation/schemas/maintenance-schemas';

export async function listMaintenanceRecords(params: {
  organizationId: string;
  searchParams: URLSearchParams;
}) {
  const equipmentId = params.searchParams.get('equipmentId');
  const status = params.searchParams.get('status');
  const type = params.searchParams.get('type');
  const page = Math.max(1, parseInt(params.searchParams.get('page') || '1') || 1);
  const pageSize = Math.min(Math.max(1, parseInt(params.searchParams.get('pageSize') || '10') || 10), 100);
  const skip = (page - 1) * pageSize;

  const where: Prisma.EquipmentMaintenanceWhereInput = maintenanceScope(params.organizationId);
  if (equipmentId) where.equipmentId = equipmentId;
  if (status) where.status = status as Prisma.EnumMaintenanceStatusFilter;
  if (type) where.type = type as Prisma.EnumMaintenanceTypeFilter;

  const [maintenances, total] = await Promise.all([
    listMaintenances(where, skip, pageSize),
    countMaintenances(where),
  ]);

  return { maintenances, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function createMaintenanceRecord(params: {
  organizationId: string;
  performedById: string;
  body: unknown;
}) {
  const parsed = maintenanceCreateSchema.safeParse(params.body);
  if (!parsed.success) {
    return { kind: 'invalid' as const, issues: parsed.error.flatten() };
  }

  const data = parsed.data;
  const setsEquipmentInMaintenance = data.status === 'SCHEDULED' || data.status === 'IN_PROGRESS';

  try {
    const result = await createMaintenanceInTransaction({
      organizationId: params.organizationId,
      performedById: params.performedById,
      setsEquipmentInMaintenance,
      data: {
        equipmentId: data.equipmentId,
        type: data.type,
        description: data.description,
        scheduledDate: data.scheduledDate ?? null,
        completedDate: data.completedDate ?? null,
        cost: data.cost != null ? new Prisma.Decimal(data.cost) : null,
        technician: data.technician ?? null,
        notes: data.notes ?? null,
        status: data.status,
      },
    });

    await logEquipmentHistory({
      equipmentId: data.equipmentId,
      action: 'MAINTENANCE',
      title: 'Mantenimiento registrado',
      description: `${data.type}: ${data.description}`,
      newData: { maintenanceId: result.id, type: data.type, status: result.status },
      performedById: params.performedById,
    });

    await createAuditRecord({
      title: 'Mantenimiento registrado',
      description: `Mantenimiento ${data.type} para equipo ${result.equipment.inventoryCode}`,
      module: 'EQUIPOS',
      category: 'CREATE',
      userId: params.performedById,
      entityId: result.id,
      organizationId: params.organizationId,
      newData: { equipmentId: data.equipmentId, type: data.type, description: data.description },
    });

    return { kind: 'created' as const, maintenance: result };
  } catch (error) {
    if (error instanceof Error && 'status' in error && typeof (error as { status: number }).status === 'number') {
      const status = (error as { status: number }).status;
      if (status === 404 || status === 409) {
        const meta = (error as { meta?: Record<string, unknown> }).meta;
        return { kind: 'http' as const, status, message: error.message, meta };
      }
    }
    throw error;
  }
}

export async function getMaintenanceRecord(id: string, organizationId: string) {
  return findMaintenanceById(id, organizationId);
}

export async function updateMaintenanceRecord(params: {
  id: string;
  organizationId: string;
  userId: string;
  body: unknown;
}) {
  const current = await findMaintenanceRecord(params.id, params.organizationId);
  if (!current) return { kind: 'not_found' as const };

  const parsed = maintenanceUpdateSchema.safeParse(params.body);
  if (!parsed.success) {
    return { kind: 'invalid' as const, issues: parsed.error.flatten() };
  }

  const updateData = parsed.data;

  if (updateData.status && updateData.status !== current.status) {
    const allowed = VALID_MAINTENANCE_TRANSITIONS[current.status as typeof MAINTENANCE_STATUSES[number]] ?? [];
    if (!allowed.includes(updateData.status as typeof MAINTENANCE_STATUSES[number])) {
      return {
        kind: 'invalid_transition' as const,
        from: current.status,
        to: updateData.status,
      };
    }
  }

  const wasActive = ['SCHEDULED', 'IN_PROGRESS'].includes(current.status);
  const finalStatus = updateData.status ?? current.status;
  const isNowActive = ['SCHEDULED', 'IN_PROGRESS'].includes(finalStatus);

  const prismaUpdate: Prisma.EquipmentMaintenanceUpdateInput = {
    ...(updateData.type !== undefined && { type: updateData.type }),
    ...(updateData.description !== undefined && { description: updateData.description }),
    ...(updateData.scheduledDate !== undefined && { scheduledDate: updateData.scheduledDate }),
    ...(updateData.completedDate !== undefined && { completedDate: updateData.completedDate }),
    ...(updateData.cost !== undefined && {
      cost: updateData.cost != null ? new Prisma.Decimal(updateData.cost) : null,
    }),
    ...(updateData.technician !== undefined && { technician: updateData.technician }),
    ...(updateData.notes !== undefined && { notes: updateData.notes }),
    ...(updateData.status !== undefined && { status: updateData.status }),
  };

  const result = await updateMaintenanceInTransaction({
    organizationId: params.organizationId,
    maintenanceId: params.id,
    updateData: prismaUpdate,
    wasActive,
    isNowActive,
  });

  await createAuditRecord({
    title: 'Actualización de mantenimiento',
    description: `Mantenimiento actualizado: ${result.description.substring(0, 50)}`,
    module: 'EQUIPOS',
    category: 'UPDATE',
    userId: params.userId,
    entityId: result.id,
    organizationId: params.organizationId,
    previousData: { status: current.status },
    newData: { status: result.status },
  });

  return { kind: 'ok' as const, maintenance: result };
}

export async function deleteMaintenanceRecord(params: {
  id: string;
  organizationId: string;
  userId: string;
}) {
  const current = await findMaintenanceRecord(params.id, params.organizationId);
  if (!current) return { kind: 'not_found' as const };

  const documentKey = current.documentUrl
    ? equipmentDocumentKeyFromUrl(current.documentUrl)
    : null;

  await deleteMaintenance(params.id, params.organizationId);

  if (documentKey) {
    await removeStoredDocument(documentKey).catch((error) => {
      console.error('[EQUIPMENT] Failed to remove maintenance document after DB delete', {
        maintenanceId: params.id,
        storageKey: documentKey,
        error,
      });
    });
  }

  await createAuditRecord({
    title: 'Eliminación de mantenimiento',
    description: 'Mantenimiento eliminado del sistema',
    module: 'EQUIPOS',
    category: 'DELETE',
    userId: params.userId,
    entityId: params.id,
    organizationId: params.organizationId,
    previousData: { type: current.type, description: current.description },
  });

  return { kind: 'ok' as const };
}
