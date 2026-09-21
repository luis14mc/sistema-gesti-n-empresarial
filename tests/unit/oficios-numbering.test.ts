import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import {
  applyNomenclaturePattern,
  formatOficioNumber,
  normalizeOficioDirection,
  normalizeOficioScope,
  parseOficioSequence,
  previewNextNumber,
  shouldGenerateOficioNumber,
  validateNomenclaturePattern,
} from '@/lib/oficios-numbering';
import {
  allocateOficioNumber,
  OficioNumberingError,
} from '@/modules/oficios/infrastructure/numbering';

describe('nomenclature patterns', () => {
  it('validates required {NUMERO} placeholder', () => {
    expect(validateNomenclaturePattern('CNI-{AÑO}').valid).toBe(false);
    expect(validateNomenclaturePattern('CNI-{NUMERO}-{AÑO}').valid).toBe(true);
  });

  it('rejects unknown placeholders', () => {
    const result = validateNomenclaturePattern('CNI-{NUMERO}-{FOO}');
    expect(result.valid).toBe(false);
  });

  it('formats CNI / Despacho / custom patterns with padding', () => {
    expect(
      applyNomenclaturePattern({
        pattern: 'CNI-{NUMERO}-{AÑO}',
        sequence: 242,
        year: 2026,
      }),
    ).toBe('CNI-242-2026');

    expect(
      applyNomenclaturePattern({
        pattern: 'DPICP-{NUMERO}-{AÑO}',
        sequence: 169,
        year: 2026,
      }),
    ).toBe('DPICP-169-2026');

    expect(
      applyNomenclaturePattern({
        pattern: 'OF-{AÑO}-{NUMERO}',
        sequence: 7,
        year: 2026,
        sequencePadding: 3,
      }),
    ).toBe('OF-2026-007');

    expect(
      applyNomenclaturePattern({
        pattern: '{PREFIJO}-{NUMERO}-{AÑO}',
        sequence: 1,
        year: 2027,
        prefix: 'CNI',
        sequencePadding: 3,
      }),
    ).toBe('CNI-001-2027');
  });

  it('previewNextNumber increments lastGeneratedSequence', () => {
    expect(
      previewNextNumber({
        pattern: 'CNI-{NUMERO}-{AÑO}',
        lastGeneratedSequence: 241,
        year: 2026,
      }),
    ).toBe('CNI-242-2026');
  });

  it('legacy formatOficioNumber uses institutional defaults', () => {
    expect(
      formatOficioNumber({ scope: 'CNI', direction: 'OUTGOING', sequence: 242, year: 2026 }),
    ).toBe('CNI-242-2026');
    expect(
      formatOficioNumber({ scope: 'DESPACHO', direction: 'OUTGOING', sequence: 169, year: 2026 }),
    ).toBe('DPICP-169-2026');
  });

  it('parseOficioSequence ignores year segments', () => {
    expect(parseOficioSequence('CNI-242-2026', 2026)).toBe(242);
    expect(parseOficioSequence('DPICP-169-2026', 2026)).toBe(169);
    expect(parseOficioSequence('773/DE/INM-2026', 2026)).toBe(773);
  });
});

describe('direction / generation rules', () => {
  it('does not generate for incoming', () => {
    expect(shouldGenerateOficioNumber('INCOMING')).toBe(false);
    expect(shouldGenerateOficioNumber('OUTGOING')).toBe(true);
  });

  it('normalizes dependency and direction independently', () => {
    expect(normalizeOficioScope('DPICP')).toBe('DESPACHO');
    expect(normalizeOficioDirection('ENTRADA', 'CNI')).toBe('INCOMING');
    expect(normalizeOficioDirection('OUTGOING', 'CNI')).toBe('OUTGOING');
  });
});

describe('allocateOficioNumber (atomic config lock)', () => {
  it('locks config, increments, and returns patterned number', async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      {
        id: 'cfg-1',
        organizationId: 'org-a',
        dependency: 'CNI',
        year: 2026,
        nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
        lastGeneratedSequence: 241,
        prefix: 'CNI',
        sequencePadding: 0,
        isActive: true,
      },
    ]);
    const update = vi.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: queryRaw,
      oficioNumberingConfig: { update },
    } as unknown as Prisma.TransactionClient;

    const result = await allocateOficioNumber(tx, {
      organizationId: 'org-a',
      scope: 'CNI',
      direction: 'OUTGOING',
      year: 2026,
    });

    expect(result.documentNumber).toBe('CNI-242-2026');
    expect(result.sequence).toBe(242);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'cfg-1' },
      data: { lastGeneratedSequence: 242 },
    });
  });

  it('uses Despacho pattern independently', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'cfg-2',
          organizationId: 'org-a',
          dependency: 'DESPACHO',
          year: 2026,
          nomenclaturePattern: 'DPICP-{NUMERO}-{AÑO}',
          lastGeneratedSequence: 168,
          prefix: 'DPICP',
          sequencePadding: 0,
          isActive: true,
        },
      ]),
      oficioNumberingConfig: { update: vi.fn().mockResolvedValue({}) },
    } as unknown as Prisma.TransactionClient;

    const result = await allocateOficioNumber(tx, {
      organizationId: 'org-a',
      scope: 'DESPACHO',
      direction: 'OUTGOING',
      year: 2026,
    });
    expect(result.documentNumber).toBe('DPICP-169-2026');
  });

  it('fails when active config is missing', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      oficioNumberingConfig: { update: vi.fn() },
    } as unknown as Prisma.TransactionClient;

    await expect(
      allocateOficioNumber(tx, {
        organizationId: 'org-a',
        scope: 'CNI',
        direction: 'OUTGOING',
        year: 2026,
      }),
    ).rejects.toBeInstanceOf(OficioNumberingError);
  });

  it('does not allocate for incoming', async () => {
    const tx = { $queryRaw: vi.fn() } as unknown as Prisma.TransactionClient;
    await expect(
      allocateOficioNumber(tx, {
        organizationId: 'org-a',
        scope: 'CNI',
        direction: 'INCOMING',
        year: 2026,
      }),
    ).rejects.toMatchObject({ code: 'NOT_GENERATABLE' });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
