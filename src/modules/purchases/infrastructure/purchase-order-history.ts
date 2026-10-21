import type { PurchaseHistoryAction, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createAuditRecord } from '@/lib/audit';

export async function recordOrdenHistorial(params: {
  orderId: string;
  organizationId: string;
  action: PurchaseHistoryAction;
  title: string;
  description?: string;
  performedById: string;
  previousData?: unknown;
  newData?: unknown;
  tx?: Prisma.TransactionClient;
}) {
  const client = params.tx ?? prisma;
  return client.compraOrdenHistorial.create({
    data: {
      orderId: params.orderId,
      action: params.action,
      title: params.title,
      description: params.description,
      previousData: params.previousData
        ? JSON.parse(JSON.stringify(params.previousData))
        : undefined,
      newData: params.newData ? JSON.parse(JSON.stringify(params.newData)) : undefined,
      performedById: params.performedById,
    },
  });
}

export async function recordOrdenAudit(params: {
  organizationId: string;
  orderId: string;
  category: string;
  title: string;
  description: string;
  userId: string;
  previousData?: unknown;
  newData?: unknown;
  tx?: Prisma.TransactionClient;
}) {
  return createAuditRecord({
    title: params.title,
    description: params.description,
    module: 'COMPRAS',
    category: params.category,
    userId: params.userId,
    entityId: params.orderId,
    organizationId: params.organizationId,
    previousData: params.previousData,
    newData: params.newData,
    tx: params.tx,
  });
}
