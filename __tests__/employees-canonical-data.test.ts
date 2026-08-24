import { describe, expect, it } from 'vitest';
import { validateHireDate } from '@/lib/employees';

describe('canonical employee data', () => {
  it('accepts a valid institutional hire date', () => {
    expect(validateHireDate('2020-02-29').toISOString()).toBe('2020-02-29T00:00:00.000Z');
  });

  it.each(['', '2024-02-30', '2024/01/01', 'not-a-date'])('rejects malformed hire date %s', (value) => {
    expect(() => validateHireDate(value)).toThrow('FECHA_INGRESO_INVALIDA');
  });

  it('rejects a future hire date', () => {
    expect(() => validateHireDate('2999-01-01')).toThrow('FECHA_INGRESO_FUTURA');
  });
});
