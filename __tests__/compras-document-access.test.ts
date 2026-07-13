import { describe, it, expect } from 'vitest';
import { canAccess } from '../src/lib/permissions';

describe('compras document access policy', () => {
  it('bloquea lectura de compras a USER sin permiso', () => {
    expect(canAccess('USER', 'purchases', 'read')).toBe(false);
  });

  it('permite lectura de compras a IT', () => {
    expect(canAccess('IT', 'purchases', 'read')).toBe(true);
  });

  it('permite lectura de compras a ADMIN', () => {
    expect(canAccess('ADMIN', 'purchases', 'read')).toBe(true);
  });
});
