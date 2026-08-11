// Phase 10B — domain unit tests for compras validation helpers.
import { describe, expect, it } from 'vitest';
import { normalizeRtn, validateRtn } from '@/lib/compras/validation';
import {
  COMPRA_ESTADO_LABELS,
  COMPRA_ESTADOS_EDITABLES,
  COMPRA_ESTADOS_FINALIZADOS,
  COMPRA_ESTADOS_PENDIENTES,
  COMPRA_IMPUESTO_TASA,
  COMPRA_UNIDAD_LABELS,
} from '@/lib/compras/constants';

describe('validateRtn', () => {
  it('returns true for an empty RTN (optional field)', () => {
    expect(validateRtn()).toBe(true);
    expect(validateRtn('')).toBe(true);
    expect(validateRtn(null)).toBe(true);
  });

  it('returns true for a 14-digit RTN', () => {
    expect(validateRtn('08011999123456')).toBe(true);
  });

  it('returns true when the RTN contains non-digit characters but 14 digits', () => {
    expect(validateRtn('0801-1999-123-456')).toBe(true);
  });

  it('returns false for an RTN with fewer than 14 digits', () => {
    expect(validateRtn('123')).toBe(false);
    expect(validateRtn('0801199912345')).toBe(false);
  });

  it('returns false for an RTN with more than 14 digits', () => {
    expect(validateRtn('080119991234567')).toBe(false);
  });
});

describe('normalizeRtn', () => {
  it('returns null for empty input', () => {
    expect(normalizeRtn()).toBeNull();
    expect(normalizeRtn('')).toBeNull();
    expect(normalizeRtn(null)).toBeNull();
  });

  it('strips non-digit characters from a valid RTN', () => {
    expect(normalizeRtn('0801-1999-123-456')).toBe('08011999123456');
  });

  it('returns null when the input has no digits', () => {
    expect(normalizeRtn('abc-d')).toBeNull();
  });
});

describe('COMPRA constants', () => {
  it('uses a 15% ISV tax rate', () => {
    expect(COMPRA_IMPUESTO_TASA).toBe(0.15);
  });

  it('exposes labels for every CompraUnidad', () => {
    for (const key of Object.keys(COMPRA_UNIDAD_LABELS)) {
      expect(COMPRA_UNIDAD_LABELS[key as keyof typeof COMPRA_UNIDAD_LABELS]).toBeTruthy();
    }
  });

  it('exposes labels for every CompraEstado', () => {
    for (const key of Object.keys(COMPRA_ESTADO_LABELS)) {
      expect(COMPRA_ESTADO_LABELS[key as keyof typeof COMPRA_ESTADO_LABELS]).toBeTruthy();
    }
  });

  it('only allows DRAFT orders to be edited', () => {
    expect(COMPRA_ESTADOS_EDITABLES).toEqual(['BORRADOR']);
  });

  it('exposes DRAFT and GENERATED as the pending states', () => {
    expect(COMPRA_ESTADOS_PENDIENTES).toEqual(['BORRADOR', 'GENERADA']);
  });

  it('exposes ISSUED, CLOSED, and CANCELLED as the finalized states', () => {
    expect(COMPRA_ESTADOS_FINALIZADOS).toEqual(['EMITIDA', 'CERRADA', 'ANULADA']);
  });
});
