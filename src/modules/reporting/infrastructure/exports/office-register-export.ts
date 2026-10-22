import type { OficioStatus, OficioType, Prisma } from '@prisma/client';
import type { ExportColumn, ExportDataset } from '@/platform/reporting/export';
import { SYNC_EXPORT_ROW_LIMIT } from '@/platform/reporting/export';
import { OFICIO_STATUS_LABELS, OFICIO_TYPE_LABELS, type OficioStatus as UiOficioStatus, type OficioType as UiOficioType } from '@/types';
import { civilDateInclusiveFilter } from '@/modules/reporting/domain/date-range';
import { ReportExportTooLargeError } from '@/modules/reporting/domain/export-errors';
import type { ReportExportBuildParams } from '@/modules/reporting/application/exports/types';

const COLUMNS: readonly ExportColumn[] = [
  { key: 'number', header: 'Número', type: 'text', width: 16 },
  { key: 'type', header: 'Tipo', type: 'text', width: 14 },
  { key: 'oficioDate', header: 'Fecha', type: 'date', width: 12 },
  { key: 'sender', header: 'Remitente', type: 'text', width: 24 },
  { key: 'recipient', header: 'Destinatario', type: 'text', width: 24 },
  { key: 'subject', header: 'Asunto', type: 'text', width: 36 },
  { key: 'status', header: 'Estado', type: 'text', width: 14 },
  { key: 'scope', header: 'Dirección', type: 'text', width: 16 },
];

const VALID_TYPES = new Set<string>(['INCOMING', 'OUTGOING', 'INTERNAL_MEMO']);
const VALID_STATUSES = new Set<string>([
  'DRAFT', 'SENT', 'RECEIVED', 'IN_PROCESS', 'COMPLETED', 'ARCHIVED',
  'ASSIGNED', 'PENDING_SIGNATURE', 'SIGNED', 'ACKNOWLEDGED', 'RESPONDED',
]);

export async function buildOfficeRegisterExportDataset(
  params: ReportExportBuildParams,
): Promise<ExportDataset> {
  const { prisma, organizationId, organizationName, from, to, filters } = params;
  const type = filters?.type;
  const status = filters?.status;
  if (type && !VALID_TYPES.has(type)) throw new Error('INVALID_TYPE');
  if (status && !VALID_STATUSES.has(status)) throw new Error('INVALID_STATUS');

  const where: Prisma.OficioWhereInput = {
    organizationId,
    archivedAt: null,
    oficioDate: civilDateInclusiveFilter(from, to),
    ...(type ? { type: type as OficioType } : {}),
    ...(status ? { status: status as OficioStatus } : {}),
  };

  const total = await prisma.oficio.count({ where });
  if (total > SYNC_EXPORT_ROW_LIMIT) throw new ReportExportTooLargeError(SYNC_EXPORT_ROW_LIMIT);

  const oficios = await prisma.oficio.findMany({
    where,
    orderBy: [{ oficioDate: 'asc' }, { number: 'asc' }],
    take: SYNC_EXPORT_ROW_LIMIT,
    select: {
      number: true,
      type: true,
      oficioDate: true,
      senderName: true,
      preparedBy: true,
      recipientName: true,
      recipient: true,
      subject: true,
      status: true,
      scope: true,
    },
  });

  const rows = oficios.map((o) => ({
    number: o.number,
    type: OFICIO_TYPE_LABELS[o.type as UiOficioType] ?? o.type,
    oficioDate: o.oficioDate,
    sender: o.senderName ?? o.preparedBy ?? '—',
    recipient: o.recipientName ?? o.recipient ?? '—',
    subject: o.subject,
    status: OFICIO_STATUS_LABELS[o.status as UiOficioStatus] ?? o.status,
    scope: o.scope ?? '—',
  }));

  const appliedFilters: Record<string, string> = { Desde: from, Hasta: to };
  if (type) appliedFilters.Tipo = OFICIO_TYPE_LABELS[type as UiOficioType] ?? type;
  if (status) appliedFilters.Estado = OFICIO_STATUS_LABELS[status as UiOficioStatus] ?? status;

  return {
    reportTitle: 'Registro de oficios',
    baseFilename: `registro-oficios-${from}_${to}`,
    organizationName,
    generatedAt: params.now ?? new Date(),
    appliedFilters,
    columns: COLUMNS,
    rows,
    summary: { number: 'TOTAL', subject: `${rows.length} oficios` },
  };
}
