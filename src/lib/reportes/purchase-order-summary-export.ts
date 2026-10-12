import type { Prisma, PrismaClient, PurchaseOrderStatus } from '@prisma/client';
import type { ExportColumn, ExportDataset } from '@/platform/reporting/export';
import { SYNC_EXPORT_ROW_LIMIT } from '@/platform/reporting/export';
import { civilDateInclusiveFilter } from './date-range';
import { ReportExportTooLargeError } from './errors';
import { toDecimalNumber } from './prisma-helpers';
import type { ReportExportBuildParams } from './types';

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Borrador',
  GENERATED: 'Generada',
  ISSUED: 'Emitida',
  CANCELLED: 'Anulada',
  CLOSED: 'Cerrada',
};

const COLUMNS: readonly ExportColumn[] = [
  { key: 'orderNumber', header: 'N.º de orden', type: 'text', width: 18 },
  { key: 'requestDate', header: 'Fecha', type: 'date', width: 12 },
  { key: 'status', header: 'Estado', type: 'text', width: 12 },
  { key: 'supplierName', header: 'Proveedor', type: 'text', width: 28 },
  { key: 'supplierRtn', header: 'RTN', type: 'text', width: 16 },
  { key: 'subtotal', header: 'Subtotal', type: 'currency', width: 14 },
  { key: 'discount', header: 'Descuento', type: 'currency', width: 14 },
  { key: 'taxableBase', header: 'Base gravable', type: 'currency', width: 14 },
  { key: 'tax', header: 'ISV', type: 'currency', width: 14 },
  { key: 'total', header: 'Total', type: 'currency', width: 16 },
];

const VALID_STATUSES = new Set<PurchaseOrderStatus>(['DRAFT', 'GENERATED', 'ISSUED', 'CANCELLED', 'CLOSED']);

export async function buildPurchaseOrderSummaryExportDataset(
  params: ReportExportBuildParams,
): Promise<ExportDataset> {
  const { prisma, organizationId, organizationName, from, to, filters } = params;
  const status = filters?.status as PurchaseOrderStatus | undefined;
  if (status && !VALID_STATUSES.has(status)) {
    throw new Error('INVALID_STATUS');
  }

  const where: Prisma.CompraOrdenWhereInput = {
    organizationId,
    deletedAt: null,
    requestDate: civilDateInclusiveFilter(from, to),
    ...(status ? { status } : {}),
  };

  const total = await prisma.compraOrden.count({ where });
  if (total > SYNC_EXPORT_ROW_LIMIT) throw new ReportExportTooLargeError(SYNC_EXPORT_ROW_LIMIT);

  const orders = await prisma.compraOrden.findMany({
    where,
    orderBy: [{ requestDate: 'asc' }, { orderNumber: 'asc' }],
    take: SYNC_EXPORT_ROW_LIMIT,
    select: {
      orderNumber: true,
      requestDate: true,
      status: true,
      supplierName: true,
      supplierRtn: true,
      subtotal: true,
      discount: true,
      tax: true,
      total: true,
    },
  });

  let sumSubtotal = 0;
  let sumDiscount = 0;
  let sumTax = 0;
  let sumTotal = 0;
  const rows = orders.map((o) => {
    const subtotal = toDecimalNumber(o.subtotal);
    const discount = toDecimalNumber(o.discount);
    const tax = toDecimalNumber(o.tax);
    const grand = toDecimalNumber(o.total);
    sumSubtotal += subtotal;
    sumDiscount += discount;
    sumTax += tax;
    sumTotal += grand;
    return {
      orderNumber: o.orderNumber ?? '(sin número)',
      requestDate: o.requestDate,
      status: STATUS_LABEL[o.status],
      supplierName: o.supplierName,
      supplierRtn: o.supplierRtn,
      subtotal,
      discount,
      taxableBase: subtotal - discount,
      tax,
      total: grand,
    };
  });

  const appliedFilters: Record<string, string> = { Desde: from, Hasta: to };
  if (status) appliedFilters.Estado = STATUS_LABEL[status];

  return {
    reportTitle: 'Resumen de órdenes de compra',
    baseFilename: `ordenes-compra-${from}_${to}`,
    organizationName,
    generatedAt: params.now ?? new Date(),
    appliedFilters,
    columns: COLUMNS,
    rows,
    summary: {
      orderNumber: 'TOTAL',
      subtotal: sumSubtotal,
      discount: sumDiscount,
      taxableBase: sumSubtotal - sumDiscount,
      tax: sumTax,
      total: sumTotal,
    },
    currencySymbol: 'L',
  };
}

/** Backward-compatible year-based wrapper for `/api/compras/reportes/export`. */
export async function buildPurchaseOrderExportDatasetByYear(input: {
  prisma: PrismaClient;
  organizationId: string;
  organizationName?: string;
  year: number;
  status?: PurchaseOrderStatus;
  now?: Date;
}): Promise<ExportDataset> {
  return buildPurchaseOrderSummaryExportDataset({
    prisma: input.prisma,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    from: `${input.year}-01-01`,
    to: `${input.year}-12-31`,
    filters: input.status ? { status: input.status } : undefined,
    now: input.now,
  });
}
