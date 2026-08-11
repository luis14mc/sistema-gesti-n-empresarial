// Phase 10B — domain unit tests for office-numbering rules.
import { describe, expect, it } from 'vitest';
import {
  formatOficioNumber,
  getAutoNumberHint,
  normalizeOficioDirection,
  normalizeOficioScope,
  parseOficioSequence,
  shouldGenerateOficioNumber,
} from '@/lib/oficios-numbering';

describe('normalizeOficioScope', () => {
  it('maps DPICP and DESPACHO to DESPACHO', () => {
    expect(normalizeOficioScope('DPICP')).toBe('DESPACHO');
    expect(normalizeOficioScope('despacho')).toBe('DESPACHO');
  });

  it('maps INTERNO / INTERNAL / MEMO / INTERNAL_MEMO to INTERNO', () => {
    expect(normalizeOficioScope('INTERNO')).toBe('INTERNO');
    expect(normalizeOficioScope('INTERNAL')).toBe('INTERNO');
    expect(normalizeOficioScope('MEMO')).toBe('INTERNO');
    expect(normalizeOficioScope('internal_memo')).toBe('INTERNO');
  });

  it('defaults to CNI for empty / unknown / CNI inputs', () => {
    expect(normalizeOficioScope()).toBe('CNI');
    expect(normalizeOficioScope('')).toBe('CNI');
    expect(normalizeOficioScope('CNI')).toBe('CNI');
    expect(normalizeOficioScope('cni')).toBe('CNI');
    expect(normalizeOficioScope('UNKNOWN')).toBe('CNI');
  });
});

describe('normalizeOficioDirection', () => {
  it('forces INTERNAL_MEMO when the scope is INTERNO', () => {
    expect(normalizeOficioDirection('INCOMING', 'INTERNO')).toBe('INTERNAL_MEMO');
    expect(normalizeOficioDirection('OUTGOING', 'INTERNO')).toBe('INTERNAL_MEMO');
  });

  it('maps INCOMING / INGRESADO / RECIBIDO to INCOMING', () => {
    expect(normalizeOficioDirection('INGRESADO')).toBe('INCOMING');
    expect(normalizeOficioDirection('RECIBIDO')).toBe('INCOMING');
    expect(normalizeOficioDirection('incoming')).toBe('INCOMING');
  });

  it('maps INTERNAL / MEMO / INTERNAL_MEMO to INTERNAL_MEMO', () => {
    expect(normalizeOficioDirection('MEMO')).toBe('INTERNAL_MEMO');
    expect(normalizeOficioDirection('INTERNAL')).toBe('INTERNAL_MEMO');
  });

  it('defaults to OUTGOING for unknown CNI / DESPACHO inputs', () => {
    expect(normalizeOficioDirection('whatever', 'CNI')).toBe('OUTGOING');
    expect(normalizeOficioDirection(undefined, 'CNI')).toBe('OUTGOING');
  });
});

describe('shouldGenerateOficioNumber', () => {
  it('generates numbers for OUTGOING and INTERNAL_MEMO only', () => {
    expect(shouldGenerateOficioNumber('OUTGOING')).toBe(true);
    expect(shouldGenerateOficioNumber('INTERNAL_MEMO')).toBe(true);
    expect(shouldGenerateOficioNumber('INCOMING')).toBe(false);
  });
});

describe('formatOficioNumber', () => {
  it('formats a DPICP out-of-office number', () => {
    expect(formatOficioNumber({ scope: 'DESPACHO', direction: 'OUTGOING', sequence: 17, year: 2026 }))
      .toBe('DPICP-0017-2026');
  });

  it('formats a CNI out-of-office number', () => {
    expect(formatOficioNumber({ scope: 'CNI', direction: 'OUTGOING', sequence: 42, year: 2026 }))
      .toBe('0042-CNI-2026');
  });

  it('formats an internal memo number', () => {
    expect(formatOficioNumber({ scope: 'INTERNO', direction: 'INTERNAL_MEMO', sequence: 3, year: 2026 }))
      .toBe('MEMO-0003-2026');
  });

  it('pads the sequence to four digits', () => {
    expect(formatOficioNumber({ scope: 'CNI', direction: 'OUTGOING', sequence: 1, year: 2026 }))
      .toBe('0001-CNI-2026');
  });

  it('throws when an incoming office is given a sequence', () => {
    expect(() => formatOficioNumber({ scope: 'CNI', direction: 'INCOMING', sequence: 1, year: 2026 }))
      .toThrow(/nomenclatura de la instituci[oó]n/i);
  });
});

describe('parseOficioSequence', () => {
  it('returns the first four-digit sequence it finds', () => {
    expect(parseOficioSequence('0042-CNI-2026')).toBe(42);
    expect(parseOficioSequence('DPICP-0017-2026')).toBe(17);
    expect(parseOficioSequence('MEMO-0003-2026')).toBe(3);
  });

  it('returns the first 4-digit block when only the year is present', () => {
    // The function returns the first 4-digit block; "CNI-2026" → 2026.
    expect(parseOficioSequence('CNI-2026')).toBe(2026);
  });

  it('returns 0 for an empty string and for inputs without any digit', () => {
    expect(parseOficioSequence('')).toBe(0);
    expect(parseOficioSequence('no-digits')).toBe(0);
  });
});

describe('getAutoNumberHint', () => {
  it('returns null for incoming offices (the institution controls the number)', () => {
    expect(getAutoNumberHint('CNI', 'INCOMING')).toBeNull();
  });

  it('returns a MEMO hint for internal memos', () => {
    expect(getAutoNumberHint('INTERNO', 'INTERNAL_MEMO')).toMatch(/MEMO-0001-2026/);
  });

  it('returns a CNI / DESPACHO hint for outgoing offices', () => {
    expect(getAutoNumberHint('CNI', 'OUTGOING')).toMatch(/0001-CNI-2026/);
    expect(getAutoNumberHint('DESPACHO', 'OUTGOING')).toMatch(/DPICP-0001-2026/);
  });
});
