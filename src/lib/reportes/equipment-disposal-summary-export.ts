import type { DisposalStatus, Prisma } from '@prisma/client';
import type { ExportColumn, ExportDataset } from '@/platform/reporting/export';
import { SYNC_EXPORT_ROW_LIMIT } from '@/platform/reporting/export';
import { civilDateTimeRangeFilter } from './date-range';
import { ReportExportTooLargeError } from './errors';
import type { ReportExportBuildParams } from './types';

const RESULT_LABEL: Record<string, string> = {
  DISPOSAL_JUSTIFIED: 'Baja justificada',
  EVALUATION_REQUIRED: 'Requiere evaluación',
  KEEP_IN_SERVICE: 'Mantener en servicio',
};

const STATUS_LABEL: Record<DisposalStatus, string> = {
  DRAFT: 'Borrador',
  PENDING_APPROVAL: 'Pendiente de aprobación',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  CANCELLED: 'Cancelado',
};

const COLUMNS: readonly ExportColumn[] = [
  { key: 'inventoryCode', header: 'Equipo', type: 'text', width: 16 },
  { key: 'status', header: 'Estado', type: 'text', width: 18 },
  { key: 'disposalResult', header: 'Resultado', type: 'text', width: 20 },
  { key: 'requestedBy', header: 'Solicitante', type: 'text', width: 22 },
  { key: 'approvedBy', header: 'Aprobador', type: 'text', width: 22 },
  { key: 'submittedAt', header: 'Fecha envío', type: 'date', width: 14 },
  { key: 'approvedAt', header: 'Fecha aprobación', type: 'date', width: 14 },
  { key: 'createdAt', header: 'Fecha registro', type: 'date', width: 14 },
];

const VALID_STATUSES = new Set<string>(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED']);

export async function buildEquipmentDisposalSummaryExportDataset(
  params: ReportExportBuildParams,
): Promise<ExportDataset> {
  const { prisma, organizationId, organizationName, from, to, filters } = params;
  const status = filters?.status;
  if (status && !VALID_STATUSES.has(status)) throw new Error('INVALID_STATUS');

  const where: Prisma.EquipmentDisposalWhereInput = {
    organizationId,
    createdAt: civilDateTimeRangeFilter(from, to),
    ...(status ? { status: status as DisposalStatus } : {}),
  };

  const total = await prisma.equipmentDisposal.count({ where });
  if (total > SYNC_EXPORT_ROW_LIMIT) throw new ReportExportTooLargeError(SYNC_EXPORT_ROW_LIMIT);

  const disposals = await prisma.equipmentDisposal.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }, { folio: 'asc' }],
    take: SYNC_EXPORT_ROW_LIMIT,
    select: {
      status: true,
      disposalResult: true,
      submittedAt: true,
      approvedAt: true,
      createdAt: true,
      equipment: { select: { inventoryCode: true } },
      evaluatedBy: { select: { firstName: true, lastName: true, email: true } },
      approvedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  const rows = disposals.map((d) => ({
    inventoryCode: d.equipment.inventoryCode,
    status: STATUS_LABEL[d.status],
    disposalResult: RESULT_LABEL[d.disposalResult] ?? d.disposalResult,
    requestedBy: `${d.evaluatedBy.firstName} ${d.evaluatedBy.lastName}`.trim() || d.evaluatedBy.email,
    approvedBy: d.approvedBy
      ? (`${d.approvedBy.firstName} ${d.approvedBy.lastName}`.trim() || d.approvedBy.email)
      : '—',
    submittedAt: d.submittedAt,
    approvedAt: d.approvedAt,
    createdAt: d.createdAt,
  }));

  const appliedFilters: Record<string, string> = { Desde: from, Hasta: to };
  if (status) appliedFilters.Estado = STATUS_LABEL[status as DisposalStatus];

  return {
    reportTitle: 'Resumen de bajas de equipos',
    baseFilename: `bajas-equipos-${from}_${to}`,
    organizationName,
    generatedAt: params.now ?? new Date(),
    appliedFilters,
    columns: COLUMNS,
    rows,
    summary: { inventoryCode: 'TOTAL', requestedBy: `${rows.length} bajas` },
  };
}
