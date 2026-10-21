import { prisma } from '@/lib/prisma';
import type { PurchaseOrderStatus } from '@prisma/client';
import { getOrganizationName } from '@/modules/purchases/infrastructure/organization-read';
import { buildPurchaseOrderExportDataset } from '@/modules/purchases/infrastructure/purchase-order-export';

export async function buildPurchaseOrderExportForYear(params: {
  organizationId: string;
  year: number;
  status?: PurchaseOrderStatus;
}) {
  const organization = await getOrganizationName(params.organizationId);
  return buildPurchaseOrderExportDataset({
    prisma,
    organizationId: params.organizationId,
    organizationName: organization?.name,
    year: params.year,
    status: params.status,
  });
}
