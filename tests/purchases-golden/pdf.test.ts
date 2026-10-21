import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { buildPurchaseOrderHtml } from '@/modules/purchases/infrastructure/purchase-order-pdf-html';

vi.mock('@/platform/integrations/application/ssrf-guard', () => ({
  assertUrlIsSafe: vi.fn(),
}));

vi.mock('@/modules/purchases/infrastructure/institution', () => ({
  resolveInstitutionLogoDataUri: vi.fn(async (path?: string) => path ?? 'data:image/png;base64,AAAA'),
}));

describe('purchases golden — PDF HTML', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })),
    );
  });

  it('HTML incluye campos clave, totales y no expone URL remota del logo sin data URI', async () => {
    const order = {
      orderNumber: 'COM-CNI-2026-00099',
      purchaseReference: 'REF-PDF',
      requestDate: new Date('2026-03-01'),
      requiredDate: new Date('2026-03-10'),
      requestedByName: 'Comprador Golden',
      requesterJobTitle: 'Analista',
      supplierName: 'Proveedor PDF SA',
      supplierRtn: '08019999999999',
      supplierPhone: '2222-2222',
      purchaseJustification: 'Justificación PDF golden',
      subtotal: new Prisma.Decimal(100),
      discountType: 'NINGUNO' as const,
      discountValue: new Prisma.Decimal(0),
      discount: new Prisma.Decimal(0),
      taxRate: new Prisma.Decimal(15),
      tax: new Prisma.Decimal(15),
      total: new Prisma.Decimal(115),
      status: 'GENERATED' as const,
      items: [
        {
          itemNumber: 1,
          description: 'Servicio',
          unit: 'UNIT',
          quantity: new Prisma.Decimal(1),
          unitPrice: new Prisma.Decimal(100),
          total: new Prisma.Decimal(100),
          taxProfile: 'GENERAL_15',
          taxableBase: new Prisma.Decimal(100),
          taxAmount: new Prisma.Decimal(15),
          itemTotal: new Prisma.Decimal(115),
          taxes: [],
        },
      ],
    };

    const html = await buildPurchaseOrderHtml(
      order as never,
      {
        name: 'T',
        institutionName: 'CNI Golden',
        institutionAddress: 'Dirección',
        logoUrl: 'https://cdn.example.com/logo.png',
        footerNote: '',
        signatureBlocks: [],
      } as never,
    );

    expect(html).toContain('COM-CNI-2026-00099');
    expect(html).toContain('Proveedor PDF SA');
    expect(html).toContain('115');
    expect(html).toContain('CNI Golden');
    expect(html).not.toContain('https://cdn.example.com/logo.png');

    const { assertUrlIsSafe } = await import('@/platform/integrations/application/ssrf-guard');
    expect(assertUrlIsSafe).toHaveBeenCalled();
  });
});
