import { describe, expect, it, vi } from 'vitest';
import { allocateOrderNumber } from '../src/lib/compras/orden/numbering';
import { purchaseOrderChildScope, purchaseOrderScope } from '../src/lib/compras/orden/tenant';

describe('CompraOrden tenant scope', () => {
  it('scopes roots directly and children through their parent order', () => {
    expect(purchaseOrderScope('org-a')).toEqual({ organizationId: 'org-a' });
    expect(purchaseOrderChildScope('org-a')).toEqual({ orden: { organizationId: 'org-a' } });
  });

  it('allocates PURCHASE_ORDER sequences by organization atomically', async () => {
    const upsert = vi.fn().mockResolvedValue({ lastValue: 7 });
    const tx = { documentSequence: { upsert } };

    await expect(allocateOrderNumber(tx as never, 'org-a', 'OC', 2026)).resolves.toEqual({
      sequenceNumber: 7,
      sequenceYear: 2026,
      orderNumber: 'OC-2026-00007',
    });
    expect(upsert).toHaveBeenCalledWith({
      where: {
        organizationId_documentType_year: {
          organizationId: 'org-a',
          documentType: 'PURCHASE_ORDER',
          year: 2026,
        },
      },
      create: {
        organizationId: 'org-a',
        documentType: 'PURCHASE_ORDER',
        year: 2026,
        lastValue: 1,
      },
      update: { lastValue: { increment: 1 } },
      select: { lastValue: true },
    });
  });
});
