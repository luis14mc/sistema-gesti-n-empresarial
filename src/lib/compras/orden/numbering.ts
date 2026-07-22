import type { Prisma } from '@prisma/client';

export function formatOrderNumber(
  prefix: string,
  year: number,
  sequenceNumber: number
): string {
  return `${prefix}-${year}-${String(sequenceNumber).padStart(5, '0')}`;
}

export async function allocateOrderNumber(
  tx: Prisma.TransactionClient,
  prefix = 'COM-CNI',
  year = new Date().getFullYear()
): Promise<{ sequenceNumber: number; sequenceYear: number; orderNumber: string }> {
  const sequence = await tx.compraOrdenSequence.upsert({
    where: { year },
    create: { year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });

  const sequenceNumber = sequence.lastValue;
  const orderNumber = formatOrderNumber(prefix, year, sequenceNumber);

  return { sequenceNumber, sequenceYear: year, orderNumber };
}
