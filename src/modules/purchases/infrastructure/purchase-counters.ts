import { prisma } from '@/lib/prisma';
import { ORDER_PENDING_STATUSES } from '@/modules/purchases/domain/purchase-order-constants';
import { purchaseOrderScope } from '@/modules/purchases/infrastructure/purchase-order-tenant';

export async function countInboxPurchaseOrders(organizationId: string) {
  return prisma.compraOrden.count({
    where: {
      organizationId,
      deletedAt: null,
      status: { in: [...ORDER_PENDING_STATUSES] },
    },
  });
}

export async function countDraftPurchaseOrders(organizationId: string, userId: string) {
  return prisma.compraOrden.count({
    where: {
      ...purchaseOrderScope(organizationId),
      deletedAt: null,
      status: 'DRAFT',
      createdById: userId,
    },
  });
}
