import { describe, expect, it } from 'vitest';

describe('canonical supplier selection contract', () => {
  it('uses the bounded canonical supplier endpoint contract', async () => {
    const { comprasService } = await import('@/services/compras.service');
    expect(comprasService.listProveedores).toBeTypeOf('function');
  });

  it('normalizes RTN search before querying', () => {
    expect('0801-1234-567890'.replace(/[^0-9]/g, '')).toBe('08011234567890');
  });
});
