import { Prisma } from '@prisma/client';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { CATEGORY_LABELS } from '@/modules/equipment/domain/equipment-asset-code';
import { logEquipmentHistory } from '@/modules/equipment/infrastructure/equipment-history';
import {
  countEquipment,
  findEquipmentForUpdate,
  getEquipmentById,
  listEquipmentRows,
  loadEquipmentStats,
  updateEquipmentRecord,
  findEmployeeByUserId,
  findOrganizationName,
} from '@/modules/equipment/infrastructure/equipment-repository';
import { mapEquipmentResponse } from '@/modules/equipment/presentation/equipment-mapper';
import { equipmentListQuerySchema } from '@/modules/equipment/presentation/schemas/equipment-queries';
import { createEquipmentRecord } from '@/modules/equipment/infrastructure/equipment-create';
import { buildEquipmentExport } from '@/modules/equipment/import-export/equipment-export';
import type { EquipmentInput } from '@/modules/equipment/import-export/schemas';
import type { EquipmentStatus } from '@prisma/client';
import { EQUIPMENT_EXCEL_TYPES } from '@/modules/equipment/import-export/types';

export async function listEquipment(params: {
  organizationId: string;
  role: string;
  userId: string;
  query: unknown;
}) {
  const { status, type, category, search, page, pageSize } = equipmentListQuerySchema.parse(params.query);
  const skip = (page - 1) * pageSize;

  const where: Prisma.EquipmentWhereInput = { organizationId: params.organizationId };
  const andConditions: Prisma.EquipmentWhereInput[] = [];

  if (params.role === 'USER') {
    const employee = await findEmployeeByUserId(params.userId);
    andConditions.push({
      assignments: {
        some: {
          status: 'ACTIVE',
          OR: [
            { userId: params.userId },
            ...(employee ? [{ employeeId: employee.id }] : []),
          ],
        },
      },
    });
  } else {
    if (status) where.status = status as Prisma.EnumEquipmentStatusFilter['equals'];
    if (category) where.category = category as Prisma.EnumEquipmentCategoryFilter['equals'];
    if (type) where.type = type;
  }

  if (search) {
    andConditions.push({
      OR: [
        { inventoryCode: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (andConditions.length > 0) where.AND = andConditions;

  const [rows, total] = await Promise.all([
    listEquipmentRows(where, skip, pageSize),
    countEquipment(where),
  ]);

  return {
    items: rows.map(mapEquipmentResponse),
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  };
}

export type CreateEquipmentResult =
  | { kind: 'duplicate' }
  | { kind: 'created'; equipment: Awaited<ReturnType<typeof createEquipmentRecord>> };

export async function createEquipment(params: {
  organizationId: string;
  userId: string;
  requestId: string;
  body: EquipmentInput;
}): Promise<CreateEquipmentResult> {
  try {
    const equipment = await createEquipmentRecord(params.body, {
      organizationId: params.organizationId,
      userId: params.userId,
      requestId: params.requestId,
    });
    return { kind: 'created', equipment };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      return { kind: 'duplicate' };
    }
    throw error;
  }
}

export async function getEquipment(id: string, organizationId: string) {
  const equipment = await getEquipmentById(id, organizationId);
  if (!equipment) return null;
  return mapEquipmentResponse(equipment);
}

const UPDATE_ALLOWED_FIELDS = [
  'type', 'category', 'brand', 'model', 'serialNumber', 'status',
  'ram', 'processor', 'storage', 'os', 'includedAccessories', 'installedSoftware', 'purchaseDate', 'purchaseOrder',
  'supplier', 'warrantyDate', 'cost', 'ipAddress', 'macAddress',
  'location', 'notes', 'retirementReason',
] as const;

export async function updateEquipment(params: {
  id: string;
  organizationId: string;
  userId: string;
  data: Record<string, unknown>;
}) {
  const current = await findEquipmentForUpdate(params.id, params.organizationId);
  if (!current) return { kind: 'not_found' as const };
  if (params.data.status === 'RETIRED' || params.data.status === 'DISPOSED') {
    return { kind: 'use_disposal_flow' as const };
  }

  const updateData: Record<string, unknown> = {};
  UPDATE_ALLOWED_FIELDS.forEach((field) => {
    if (params.data[field] !== undefined) updateData[field] = params.data[field];
  });
  if (updateData.cost != null && typeof updateData.cost === 'number') {
    updateData.cost = new Prisma.Decimal(updateData.cost);
  }

  const equipment = await updateEquipmentRecord(params.id, params.organizationId, updateData);

  const action = params.data.status && params.data.status !== current.status ? 'STATUS_CHANGED' : 'UPDATED';
  await logEquipmentHistory({
    equipmentId: equipment.id,
    action,
    title: action === 'STATUS_CHANGED' ? 'Estado actualizado' : 'Equipo actualizado',
    description: `Equipo ${equipment.inventoryCode} actualizado.`,
    previousData: { status: current.status },
    newData: { status: equipment.status, ...updateData },
    performedById: params.userId,
  });

  await createAuditRecord({
    title: 'Actualización de equipo',
    description: `Se actualizó equipo: ${equipment.inventoryCode}`,
    module: 'EQUIPOS',
    category: 'UPDATE',
    userId: params.userId,
    entityId: equipment.id,
    entityType: 'Equipment',
    organizationId: params.organizationId,
    action: 'EQUIPMENT_UPDATED',
    previousData: { status: current.status },
    newData: { status: equipment.status },
  });

  return { kind: 'ok' as const, equipment: mapEquipmentResponse(equipment) };
}

export async function getEquipmentStats(organizationId: string) {
  const [
    total,
    available,
    assigned,
    inMaintenance,
    damaged,
    retired,
    lost,
    withoutSerial,
    warrantyExpiring,
    byCategory,
    byDepartment,
  ] = await loadEquipmentStats(organizationId);

  const categoryStats = byCategory.map((item) => ({
    category: item.category,
    label: CATEGORY_LABELS[item.category],
    count: item._count._all,
  }));

  const departmentStats = byDepartment
    .filter((item) => item.departmentAtTime)
    .map((item) => ({
      department: item.departmentAtTime,
      count: item._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total,
    available,
    assigned,
    inMaintenance,
    damaged,
    retired,
    lost,
    withoutSerial,
    warrantyExpiring,
    unassigned: available,
    byCategory: categoryStats,
    byDepartment: departmentStats,
  };
}

const EXPORT_STATUSES: EquipmentStatus[] = ['AVAILABLE', 'ASSIGNED', 'IN_MAINTENANCE', 'DAMAGED', 'LOST', 'RETIRED', 'DISPOSED'];

export function parseEquipmentExportFilters(searchParams: URLSearchParams) {
  const search = searchParams.get('search')?.trim() || undefined;
  const statusValue = searchParams.get('status')?.toUpperCase();
  const typeValue = searchParams.get('type')?.toUpperCase();
  if (statusValue && !EXPORT_STATUSES.includes(statusValue as EquipmentStatus)) {
    return { error: 'INVALID_STATUS' as const };
  }
  if (typeValue && !EQUIPMENT_EXCEL_TYPES.includes(typeValue as never)) {
    return { error: 'INVALID_TYPE' as const };
  }
  return {
    search,
    status: statusValue as EquipmentStatus | undefined,
    type: typeValue,
  };
}

export async function exportEquipmentInventory(params: {
  organizationId: string;
  userId: string;
  requestId: string;
  search?: string;
  status?: EquipmentStatus;
  type?: string;
}) {
  const org = await findOrganizationName(params.organizationId);
  const { artifact, exportedRows } = await buildEquipmentExport({
    organizationId: params.organizationId,
    organizationName: org?.name,
    search: params.search,
    status: params.status,
    type: params.type,
  });
  await createAuditRecord({
    title: 'Exportación de inventario de equipos',
    description: `Se exportaron ${exportedRows} equipos.`,
    module: 'EQUIPOS',
    category: 'EXPORT',
    action: 'EQUIPMENT_EXPORT',
    userId: params.userId,
    organizationId: params.organizationId,
    requestId: params.requestId,
    metadata: {
      scope: params.search || params.status || params.type ? 'FILTERED' : 'ALL',
      exportedRows,
    },
  });
  return { artifact, exportedRows };
}
