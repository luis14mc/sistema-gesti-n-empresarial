import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { allocateNumeroOrden } from '@/lib/compras/numbering';
import { allocateOrderNumber, formatOrderNumber } from '@/lib/compras/orden/numbering';

describe('purchases golden — numeración', () => {
  it('formato COM-CNI-{año}-{secuencia 5 dígitos}', () => {
    expect(formatOrderNumber('COM-CNI', 2026, 7)).toBe('COM-CNI-2026-00007');
  });

  it('legacy OC-CNI secuencia consecutiva en transacción', async () => {
    let last = 100;
    const tx = {
      compraSequence: {
        findUnique: vi.fn(async () => ({ lastValue: last })),
        upsert: vi.fn(async ({ update }: { update: { lastValue: number } }) => {
          last = update.lastValue;
          return { lastValue: last };
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const first = await allocateNumeroOrden(tx);
    const second = await allocateNumeroOrden(tx);
    expect(first).toMatch(/^OC-CNI-\d{4}-\d{4}$/);
    expect(second).toMatch(/^OC-CNI-\d{4}-\d{4}$/);
    const seq1 = Number(first.split('-')[2]);
    const seq2 = Number(second.split('-')[2]);
    expect(seq2).toBe(seq1 + 1);
  });

  it('allocateOrderNumber: secuencia consecutiva', async () => {
    let seq = 41;
    const tx = {
      documentSequence: {
        upsert: vi.fn(async () => {
          seq += 1;
          return { lastValue: seq };
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const first = await allocateOrderNumber(tx, 'org-1', 'COM-CNI', 2026);
    const second = await allocateOrderNumber(tx, 'org-1', 'COM-CNI', 2026);
    expect(first.orderNumber).toBe('COM-CNI-2026-00042');
    expect(second.orderNumber).toBe('COM-CNI-2026-00043');
    expect(first.orderNumber).not.toBe(second.orderNumber);
  });

  it('dos asignaciones concurrentes no repiten número (orden)', async () => {
    let seq = 50;
    let chain: Promise<unknown> = Promise.resolve();

    const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
      const result = chain.then(fn) as Promise<T>;
      chain = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    };

    const makeTx = () =>
      ({
        documentSequence: {
          upsert: vi.fn(async () => {
            await new Promise((r) => setTimeout(r, 5));
            seq += 1;
            return { lastValue: seq };
          }),
        },
      }) as unknown as Prisma.TransactionClient;

    const results = await Promise.all([
      enqueue(() => allocateOrderNumber(makeTx(), 'org-1', 'COM-CNI', 2026)),
      enqueue(() => allocateOrderNumber(makeTx(), 'org-1', 'COM-CNI', 2026)),
    ]);

    const numbers = results.map((r) => r.orderNumber);
    expect(new Set(numbers).size).toBe(2);
    expect(numbers.sort()).toEqual(['COM-CNI-2026-00051', 'COM-CNI-2026-00052']);
  });

  it('año nuevo reinicia secuencia en formato', async () => {
    const tx = {
      documentSequence: {
        upsert: vi.fn(async () => ({ lastValue: 1 })),
      },
    } as unknown as Prisma.TransactionClient;
    const result = await allocateOrderNumber(tx, 'org-1', 'COM-CNI', 2027);
    expect(result.orderNumber).toBe('COM-CNI-2027-00001');
    expect(result.sequenceYear).toBe(2027);
  });
});
