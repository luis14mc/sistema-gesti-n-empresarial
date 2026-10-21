import { describe, expect, it } from 'vitest';
import { ORDER_PENDING_STATUSES } from '@/lib/compras/orden/constants';
import { purchaseOrderScope } from '@/lib/compras/orden/tenant';
import fixture from './__fixtures__/counters.json';

describe('purchases golden — contadores bandeja / borradores', () => {
  it('bandeja: estados pendientes canonical', () => {
    expect([...ORDER_PENDING_STATUSES]).toEqual(fixture.bandeja.statusIn);
  });

  it('borradores: scope multi-tenant + borrador del usuario', () => {
    const scope = purchaseOrderScope('org-golden');
    expect(scope).toEqual({ organizationId: 'org-golden' });
    expect(fixture.borradores.status).toBe('DRAFT');
    expect(fixture.borradores.requiresCreatedById).toBe(true);
  });

  it('permisos documentados', () => {
    expect(fixture.bandeja.permission).toBe('purchase-orders.read');
    expect(fixture.borradores.permission).toBe('purchase-orders.read');
  });
});
