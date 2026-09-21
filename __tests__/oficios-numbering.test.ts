import { describe, it, expect, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { allocateOficioNumber } from '../src/modules/oficios/infrastructure/numbering';
import {
  formatOficioNumber,
  parseOficioSequence,
  normalizeOficioScope,
  normalizeOficioDirection,
  shouldGenerateOficioNumber,
  OFICIO_SCOPE_PATHS,
  validateNomenclaturePattern,
  applyNomenclaturePattern,
} from '../src/lib/oficios-numbering';

describe('Oficios numbering', () => {
  it('allocates the next number atomically from OficioNumberingConfig', async () => {
    const update = vi.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'cfg-1',
          organizationId: 'org-a',
          dependency: 'CNI',
          year: 2026,
          nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
          lastGeneratedSequence: 11,
          prefix: 'CNI',
          sequencePadding: 0,
          isActive: true,
        },
      ]),
      oficioNumberingConfig: { update },
    } as unknown as Prisma.TransactionClient;

    await expect(
      allocateOficioNumber(tx, {
        organizationId: 'org-a',
        scope: 'CNI',
        direction: 'OUTGOING',
        year: 2026,
      }),
    ).resolves.toMatchObject({ documentNumber: 'CNI-12-2026', sequence: 12 });
  });

  describe('normalizeOficioScope', () => {
    it('maps legacy aliases to canonical scopes', () => {
      expect(normalizeOficioScope('CNI')).toBe('CNI');
      expect(normalizeOficioScope('DESPACHO')).toBe('DESPACHO');
      expect(normalizeOficioScope('DPICP')).toBe('DESPACHO');
      expect(normalizeOficioScope('INTERNO')).toBe('INTERNO');
    });

    it('defaults unknown values to CNI', () => {
      expect(normalizeOficioScope(null)).toBe('CNI');
      expect(normalizeOficioScope('BOGUS')).toBe('CNI');
    });
  });

  describe('normalizeOficioDirection', () => {
    it('maps aliases', () => {
      expect(normalizeOficioDirection('INCOMING')).toBe('INCOMING');
      expect(normalizeOficioDirection('INGRESADO')).toBe('INCOMING');
      expect(normalizeOficioDirection('OUTGOING')).toBe('OUTGOING');
      expect(normalizeOficioDirection('INTERNAL_MEMO')).toBe('INTERNAL_MEMO');
    });

    it('forces INTERNAL_MEMO when scope is INTERNO', () => {
      expect(normalizeOficioDirection('INCOMING', 'INTERNO')).toBe('INTERNAL_MEMO');
    });
  });

  describe('shouldGenerateOficioNumber', () => {
    it('does NOT generate for INCOMING', () => {
      expect(shouldGenerateOficioNumber('INCOMING')).toBe(false);
    });

    it('generates for OUTGOING and INTERNAL_MEMO', () => {
      expect(shouldGenerateOficioNumber('OUTGOING')).toBe(true);
      expect(shouldGenerateOficioNumber('INTERNAL_MEMO')).toBe(true);
    });
  });

  describe('formatOficioNumber', () => {
    it('CNI outgoing: CNI-1-2026', () => {
      expect(
        formatOficioNumber({ scope: 'CNI', direction: 'OUTGOING', sequence: 1, year: 2026 }),
      ).toBe('CNI-1-2026');
    });

    it('DESPACHO outgoing: DPICP-1-2026', () => {
      expect(
        formatOficioNumber({ scope: 'DESPACHO', direction: 'OUTGOING', sequence: 1, year: 2026 }),
      ).toBe('DPICP-1-2026');
    });

    it('throws on INCOMING', () => {
      expect(() =>
        formatOficioNumber({ scope: 'CNI', direction: 'INCOMING', sequence: 1, year: 2026 }),
      ).toThrow();
    });
  });

  describe('parseOficioSequence', () => {
    it('extracts sequence ignoring year', () => {
      expect(parseOficioSequence('CNI-1-2026', 2026)).toBe(1);
      expect(parseOficioSequence('DPICP-42-2026', 2026)).toBe(42);
    });
  });

  describe('pattern helpers', () => {
    it('validates and applies patterns', () => {
      expect(validateNomenclaturePattern('CNI-{NUMERO}-{AÑO}').valid).toBe(true);
      expect(applyNomenclaturePattern({
        pattern: 'CNI-{NUMERO}-{AÑO}',
        sequence: 242,
        year: 2026,
      })).toBe('CNI-242-2026');
    });
  });

  describe('OFICIO_SCOPE_PATHS', () => {
    it('maps each scope to its dedicated path', () => {
      expect(OFICIO_SCOPE_PATHS.INTERNO).toBe('/oficios/internos');
      expect(OFICIO_SCOPE_PATHS.CNI).toBe('/oficios/cni');
      expect(OFICIO_SCOPE_PATHS.DESPACHO).toBe('/oficios/despacho');
    });
  });
});
