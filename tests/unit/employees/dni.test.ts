import { describe, expect, it } from 'vitest';
import { normalizeHondurasDni, parseOptionalDni } from '@/modules/people/domain/dni';

describe('normalizeHondurasDni', () => {
  it('accepts dashed and stores normalized', () => {
    expect(normalizeHondurasDni('0801-1990-12345')).toBe('0801-1990-12345');
    expect(normalizeHondurasDni('0801199012345')).toBe('0801-1990-12345');
  });

  it('rejects invalid length', () => {
    expect(() => normalizeHondurasDni('123')).toThrow('DNI_INVALIDO');
  });
});

describe('parseOptionalDni', () => {
  it('returns null for empty optional', () => {
    expect(parseOptionalDni('')).toBeNull();
    expect(parseOptionalDni(undefined)).toBeUndefined();
  });
});
