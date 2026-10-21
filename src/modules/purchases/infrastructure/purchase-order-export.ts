import type { PrismaClient, PurchaseOrderStatus } from '@prisma/client';
import type { ExportDataset } from '@/platform/reporting/export';
import { buildPurchaseOrderExportDatasetByYear } from '@/lib/reportes/purchase-order-summary-export';
import { ReportExportTooLargeError } from '@/lib/reportes/errors';

export type PurchaseOrderExportParams = {
  prisma: PrismaClient;
  organizationId: string;
  organizationName?: string;
  year: number;
  status?: PurchaseOrderStatus;
  now?: Date;
};

/** Alias kept for compras route/tests (`instanceof` matches thrown errors). */
export const PurchaseExportTooLargeError = ReportExportTooLargeError;

export async function buildPurchaseOrderExportDataset(
  params: PurchaseOrderExportParams,
): Promise<ExportDataset> {
  return buildPurchaseOrderExportDatasetByYear(params);
}
