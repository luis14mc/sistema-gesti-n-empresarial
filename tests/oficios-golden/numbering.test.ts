import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import {
  applyNomenclaturePattern,
  previewNextNumber,
  validateNomenclaturePattern,
} from '@/lib/oficios-numbering';
import {
  allocateOficioNumber,
  previewOficioNumber,
} from '@/modules/oficios/infrastructure/numbering';
import { upsertNumberingConfig } from '@/modules/oficios/application/numbering-config';

describe('oficios golden — numeración', () => {
  it('formato por prefijo, año y padding', () => {
    expect(
      applyNomenclaturePattern({
        pattern: 'CNI-{NUMERO}-{AÑO}',
        sequence: 7,
        year: 2026,
        prefix: 'CNI',
        sequencePadding: 3,
      }),
    ).toBe('CNI-007-2026');
  });

  it('secuencia consecutiva al asignar dos veces', async () => {
    let lastSeq = 100;
    const makeTx = () =>
      ({
        $queryRaw: vi.fn().mockImplementation(async () => [
          {
            id: 'cfg-1',
            organizationId: 'org-1',
            dependency: 'CNI',
            year: 2026,
            nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
            lastGeneratedSequence: lastSeq,
            prefix: 'CNI',
            sequencePadding: 0,
            isActive: true,
          },
        ]),
        oficioNumberingConfig: {
          update: vi.fn().mockImplementation(async ({ data }: { data: { lastGeneratedSequence: number } }) => {
            lastSeq = data.lastGeneratedSequence;
          }),
        },
      }) as unknown as Prisma.TransactionClient;

    const first = await allocateOficioNumber(makeTx(), {
      organizationId: 'org-1',
      scope: 'CNI',
      direction: 'OUTGOING',
      year: 2026,
    });
    const second = await allocateOficioNumber(makeTx(), {
      organizationId: 'org-1',
      scope: 'CNI',
      direction: 'OUTGOING',
      year: 2026,
    });
    expect(first.documentNumber).toBe('CNI-101-2026');
    expect(second.documentNumber).toBe('CNI-102-2026');
    expect(first.documentNumber).not.toBe(second.documentNumber);
  });

  it('dos asignaciones concurrentes no repiten número (simula FOR UPDATE serializado)', async () => {
    let lastSeq = 50;
    let chain: Promise<unknown> = Promise.resolve();

    const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
      const result = chain.then(fn) as Promise<T>;
      chain = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    };

    const tx = {
      $queryRaw: vi.fn().mockImplementation(async () => [
        {
          id: 'cfg-concurrent',
          organizationId: 'org-1',
          dependency: 'CNI',
          year: 2026,
          nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
          lastGeneratedSequence: lastSeq,
          prefix: 'CNI',
          sequencePadding: 0,
          isActive: true,
        },
      ]),
      oficioNumberingConfig: {
        update: vi.fn().mockImplementation(async ({ data }: { data: { lastGeneratedSequence: number } }) => {
          lastSeq = data.lastGeneratedSequence;
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const input = {
      organizationId: 'org-1',
      scope: 'CNI' as const,
      direction: 'OUTGOING' as const,
      year: 2026,
    };

    const lockedAllocate = () => enqueue(() => allocateOficioNumber(tx, input));

    const [a, b] = await Promise.all([lockedAllocate(), lockedAllocate()]);
    expect(new Set([a.documentNumber, b.documentNumber]).size).toBe(2);
  });

  it('previewNextNumber no consume secuencia persistida', () => {
    const before = 240;
    const preview = previewNextNumber({
      pattern: 'CNI-{NUMERO}-{AÑO}',
      lastGeneratedSequence: before,
      year: 2026,
    });
    expect(preview).toBe('CNI-241-2026');
    expect(
      previewNextNumber({
        pattern: 'CNI-{NUMERO}-{AÑO}',
        lastGeneratedSequence: before,
        year: 2026,
      }),
    ).toBe('CNI-241-2026');
  });

  it('previewOficioNumber en BD no incrementa lastGeneratedSequence', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
      lastGeneratedSequence: 88,
      year: 2026,
      prefix: 'CNI',
      sequencePadding: 0,
      isActive: true,
    });
    const update = vi.fn();
    const db = {
      oficioNumberingConfig: { findUnique, update },
    } as unknown as Prisma.TransactionClient;

    const preview = await previewOficioNumber(db, {
      organizationId: 'org-1',
      dependency: 'CNI',
      year: 2026,
    });
    expect(preview?.nextNumber).toBe('CNI-89-2026');
    expect(preview?.lastGeneratedSequence).toBe(88);
    expect(update).not.toHaveBeenCalled();
  });

  it('continuación manual desde último número configurado', async () => {
    const db = {
      oficio: { findMany: vi.fn().mockResolvedValue([{ number: 'CNI-300-2026' }]) },
      oficioNumberingConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'cfg-1',
          lastGeneratedSequence: 250,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'cfg-1',
          dependency: 'CNI',
          year: 2026,
          nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
          lastGeneratedSequence: 300,
          prefix: 'CNI',
          sequencePadding: 0,
          isActive: true,
          notes: null,
        }),
        create: vi.fn(),
      },
    };

    const config = await upsertNumberingConfig(db as never, 'org-1', 'admin-1', {
      dependency: 'CNI',
      year: 2026,
      nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
      lastGeneratedSequence: 300,
    });

    expect(config.lastGeneratedSequence).toBe(300);
    expect(
      previewNextNumber({
        pattern: config.nomenclaturePattern,
        lastGeneratedSequence: config.lastGeneratedSequence,
        year: 2026,
        prefix: 'CNI',
      }),
    ).toBe('CNI-301-2026');
  });

  it('patrón inválido rechazado', () => {
    expect(validateNomenclaturePattern('SIN-NUMERO').valid).toBe(false);
  });
});
