import type { PrismaClient, PurchaseOrderStatus, Prisma } from '@prisma/client';
import type { ExportColumn, ExportDataset } from '@/platform/reporting/export';
import { SYNC_EXPORT_ROW_LIMIT } from '@/platform/reporting/export';

// Accurate, non-lossy status labels for exports (ORDER_STATUS_LABELS collapses
// several states and must not be used for a financial report).
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

export type PurchaseOrderExportParams = {
  prisma: PrismaClient;
  organizationId: string;
  organizationName?: string;
  year: number;
  status?: PurchaseOrderStatus;
  now?: Date;
};

export class PurchaseExportTooLargeError extends Error {
  constructor(public readonly limit: number) {
    super('EXPORT_ROW_LIMIT_EXCEEDED');
    this.name = 'PurchaseExportTooLargeError';
  }
}

function toNum(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

/**
 * Build the canonical Purchase Order Summary dataset from `CompraOrden`
 * (never `CompraSolicitud`). Tenant-scoped, date-filtered, status-filtered,
 * excludes soft-deleted rows, and enforces the synchronous row limit.
 */
export async function buildPurchaseOrderExportDataset(
  params: PurchaseOrderExportParams,
): Promise<ExportDataset> {
  const { prisma, organizationId, organizationName, year, status } = params;
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const where: Prisma.CompraOrdenWhereInput = {
    organizationId,
    deletedAt: null,
    requestDate: { gte: start, lt: end },
    ...(status ? { status } : {}),
  };

  const total = await prisma.compraOrden.count({ where });
  if (total > SYNC_EXPORT_ROW_LIMIT) {
    throw new PurchaseExportTooLargeError(SYNC_EXPORT_ROW_LIMIT);
  }

  const orders = await prisma.compraOrden.findMany({
    where,
    orderBy: [{ requestDate: 'asc' }, { orderNumber: 'asc' }],
    take: SYNC_EXPORT_ROW_LIMIT,
    select: {
      orderNumber: true, requestDate: true, status: true,
      supplierName: true, supplierRtn: true,
      subtotal: true, discount: true, tax: true, total: true,
    },
  });

  let sumSubtotal = 0, sumDiscount = 0, sumTax = 0, sumTotal = 0;
  const rows = orders.map((o) => {
    const subtotal = toNum(o.subtotal);
    const discount = toNum(o.discount);
    const tax = toNum(o.tax);
    const grand = toNum(o.total);
    sumSubtotal += subtotal; sumDiscount += discount; sumTax += tax; sumTotal += grand;
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

  const appliedFilters: Record<string, string> = { 'Año': String(year) };
  if (status) appliedFilters['Estado'] = STATUS_LABEL[status];

  return {
    reportTitle: 'Resumen de órdenes de compra',
    baseFilename: `ordenes-compra-${year}${status ? `-${status.toLowerCase()}` : ''}`,
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
