// Phase 10B — domain unit tests for the purchase order tenant scope.
import { describe, expect, it } from 'vitest';
import { purchaseOrderChildScope, purchaseOrderScope } from '@/lib/compras/orden/tenant';

describe('purchaseOrderScope', () => {
  it('isolates purchase orders by organizationId', () => {
    expect(purchaseOrderScope('org-a')).toEqual({ organizationId: 'org-a' });
    expect(purchaseOrderScope('org-a')).not.toEqual(purchaseOrderScope('org-b'));
  });
});

describe('purchaseOrderChildScope', () => {
  it('scopes child tables through the parent order organization', () => {
    expect(purchaseOrderChildScope('org-a')).toEqual({ orden: { organizationId: 'org-a' } });
  });
});
