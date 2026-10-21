import type { AssignmentStatus, Prisma } from '@prisma/client';
import type { ExportColumn, ExportDataset } from '@/platform/reporting/export';
import { SYNC_EXPORT_ROW_LIMIT } from '@/platform/reporting/export';
import { civilDateTimeRangeFilter } from '@/modules/reporting/domain/date-range';
import { ReportExportTooLargeError } from '@/modules/reporting/domain/export-errors';
import type { ReportExportBuildParams } from '@/modules/reporting/application/exports/types';

const STATUS_LABEL: Record<AssignmentStatus, string> = {
  ACTIVE: 'Activa',
  RETURNED: 'Devuelta',
  REPLACED: 'Reemplazada',
  LOST: 'Perdida',
  CANCELLED: 'Cancelada',
};

const COLUMNS: readonly ExportColumn[] = [
  { key: 'inventoryCode', header: 'Equipo', type: 'text', width: 16 },
  { key: 'employeeName', header: 'Empleado', type: 'text', width: 24 },
  { key: 'department', header: 'Departamento', type: 'text', width: 20 },
  { key: 'assignedDate', header: 'Fecha asignación', type: 'date', width: 14 },
  { key: 'returnedDate', header: 'Fecha devolución', type: 'date', width: 14 },
  { key: 'status', header: 'Estado', type: 'text', width: 12 },
];

const VALID_STATUSES = new Set<string>(['ACTIVE', 'RETURNED', 'REPLACED', 'LOST', 'CANCELLED']);

export async function buildEquipmentAssignmentHistoryExportDataset(
  params: ReportExportBuildParams,
): Promise<ExportDataset> {
  const { prisma, organizationId, organizationName, from, to, filters } = params;
  const status = filters?.status;
  if (status && !VALID_STATUSES.has(status)) throw new Error('INVALID_STATUS');

  const where: Prisma.EquipmentAssignmentWhereInput = {
    organizationId,
    assignedDate: civilDateTimeRangeFilter(from, to),
    ...(status ? { status: status as AssignmentStatus } : {}),
  };

  const total = await prisma.equipmentAssignment.count({ where });
  if (total > SYNC_EXPORT_ROW_LIMIT) throw new ReportExportTooLargeError(SYNC_EXPORT_ROW_LIMIT);

  const assignments = await prisma.equipmentAssignment.findMany({
    where,
    orderBy: [{ assignedDate: 'asc' }, { createdAt: 'asc' }],
    take: SYNC_EXPORT_ROW_LIMIT,
    select: {
      assignedDate: true,
      returnedDate: true,
      status: true,
      employeeNameSnapshot: true,
      employeeNameAtTime: true,
      departmentSnapshot: true,
      departmentAtTime: true,
      equipment: { select: { inventoryCode: true } },
    },
  });

  const rows = assignments.map((a) => ({
    inventoryCode: a.equipment.inventoryCode,
    employeeName: a.employeeNameSnapshot ?? a.employeeNameAtTime ?? '—',
    department: a.departmentSnapshot ?? a.departmentAtTime ?? '—',
    assignedDate: a.assignedDate,
    returnedDate: a.returnedDate,
    status: STATUS_LABEL[a.status],
  }));

  const appliedFilters: Record<string, string> = { Desde: from, Hasta: to };
  if (status) appliedFilters.Estado = STATUS_LABEL[status as AssignmentStatus];

  return {
    reportTitle: 'Historial de asignaciones',
    baseFilename: `historial-asignaciones-${from}_${to}`,
    organizationName,
    generatedAt: params.now ?? new Date(),
    appliedFilters,
    columns: COLUMNS,
    rows,
    summary: { inventoryCode: 'TOTAL', employeeName: `${rows.length} asignaciones` },
  };
}
