import { describe, it, expect } from 'vitest';
import {
  formatOficioNumber,
  parseOficioSequence,
  normalizeOficioScope,
  normalizeOficioDirection,
  shouldGenerateOficioNumber,
  OFICIO_SCOPE_PATHS,
} from '../src/lib/oficios-numbering';

describe('Oficios numbering', () => {
  describe('normalizeOficioScope', () => {
    it('maps legacy aliases to canonical scopes', () => {
      expect(normalizeOficioScope('CNI')).toBe('CNI');
      expect(normalizeOficioScope('DESPACHO')).toBe('DESPACHO');
      expect(normalizeOficioScope('DPICP')).toBe('DESPACHO');
      expect(normalizeOficioScope('INTERNO')).toBe('INTERNO');
      expect(normalizeOficioScope('interno')).toBe('INTERNO');
      expect(normalizeOficioScope('despacho')).toBe('DESPACHO');
    });

    it('defaults unknown values to CNI', () => {
      expect(normalizeOficioScope(null)).toBe('CNI');
      expect(normalizeOficioScope(undefined)).toBe('CNI');
      expect(normalizeOficioScope('')).toBe('CNI');
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
      expect(normalizeOficioDirection('OUTGOING', 'INTERNO')).toBe('INTERNAL_MEMO');
    });

    it('defaults to OUTGOING for unknown values', () => {
      expect(normalizeOficioDirection('BOGUS')).toBe('OUTGOING');
      expect(normalizeOficioDirection(null)).toBe('OUTGOING');
    });
  });

  describe('shouldGenerateOficioNumber', () => {
    it('does NOT generate for INCOMING (preserve external sender number)', () => {
      expect(shouldGenerateOficioNumber('INCOMING')).toBe(false);
    });

    it('generates for OUTGOING and INTERNAL_MEMO', () => {
      expect(shouldGenerateOficioNumber('OUTGOING')).toBe(true);
      expect(shouldGenerateOficioNumber('INTERNAL_MEMO')).toBe(true);
    });
  });

  describe('formatOficioNumber', () => {
    it('CNI outgoing: 0001-CNI-2026', () => {
      expect(
        formatOficioNumber({ scope: 'CNI', direction: 'OUTGOING', sequence: 1, year: 2026 })
      ).toBe('0001-CNI-2026');
      expect(
        formatOficioNumber({ scope: 'CNI', direction: 'OUTGOING', sequence: 42, year: 2026 })
      ).toBe('0042-CNI-2026');
    });

    it('DESPACHO outgoing: DPICP-0001-2026', () => {
      expect(
        formatOficioNumber({ scope: 'DESPACHO', direction: 'OUTGOING', sequence: 1, year: 2026 })
      ).toBe('DPICP-0001-2026');
      expect(
        formatOficioNumber({ scope: 'DESPACHO', direction: 'OUTGOING', sequence: 7, year: 2025 })
      ).toBe('DPICP-0007-2025');
    });

    it('INTERNAL_MEMO: MEMO-0001-2026', () => {
      expect(
        formatOficioNumber({ scope: 'INTERNO', direction: 'INTERNAL_MEMO', sequence: 1, year: 2026 })
      ).toBe('MEMO-0001-2026');
    });

    it('throws on INCOMING (caller should not generate)', () => {
      expect(() =>
        formatOficioNumber({ scope: 'CNI', direction: 'INCOMING', sequence: 1, year: 2026 })
      ).toThrow();
    });
  });

  describe('parseOficioSequence', () => {
    it('extracts the 4-digit sequence from formatted numbers', () => {
      expect(parseOficioSequence('0001-CNI-2026')).toBe(1);
      expect(parseOficioSequence('DPICP-0042-2026')).toBe(42);
      expect(parseOficioSequence('MEMO-0007-2025')).toBe(7);
    });

    it('returns 0 for malformed inputs (safe fallback)', () => {
      expect(parseOficioSequence('garbage')).toBe(0);
      expect(parseOficioSequence('123')).toBe(0);
      expect(parseOficioSequence('')).toBe(0);
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
