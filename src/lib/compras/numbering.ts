import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const PREFIX = 'OC-CNI';

export async function allocateNumeroOrden(
  tx?: Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getFullYear();
  const client = tx ?? prisma;

  const run = async (db: Prisma.TransactionClient) => {
    const existing = await db.compraSequence.findUnique({
      where: { year_prefix: { year, prefix: PREFIX } },
    });
    const next = (existing?.lastValue ?? 0) + 1;

    await db.compraSequence.upsert({
      where: { year_prefix: { year, prefix: PREFIX } },
      create: { year, prefix: PREFIX, lastValue: next },
      update: { lastValue: next },
    });

    return `${PREFIX}-${String(next).padStart(4, '0')}-${year}`;
  };

  if (tx) return run(tx);
  return prisma.$transaction(run);
}
