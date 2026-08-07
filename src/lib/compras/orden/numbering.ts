import type { Prisma } from '@prisma/client';
import { allocateDocumentSequence } from '@/platform/sequences/document-sequence';

export function formatOrderNumber(
  prefix: string,
  year: number,
  sequenceNumber: number
): string {
  return `${prefix}-${year}-${String(sequenceNumber).padStart(5, '0')}`;
}

export async function allocateOrderNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
  prefix = 'COM-CNI',
  year = new Date().getFullYear()
): Promise<{ sequenceNumber: number; sequenceYear: number; orderNumber: string }> {
  const sequenceNumber = await allocateDocumentSequence(tx, {
    organizationId,
    documentType: 'PURCHASE_ORDER',
    year,
  });
  const orderNumber = formatOrderNumber(prefix, year, sequenceNumber);

  return { sequenceNumber, sequenceYear: year, orderNumber };
}
