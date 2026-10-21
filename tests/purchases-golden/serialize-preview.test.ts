import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { serializePurchaseOrder } from '@/modules/purchases/presentation/purchase-order-serialize';
import { buildPreviewDataFromInput } from '@/modules/purchases/presentation/purchase-order-preview-data';
import fixture from './__fixtures__/serialize-preview.json';

const template = {
  name: 'Plantilla golden',
  institutionName: 'CNI',
  institutionAddress: 'Tegucigalpa',
  institutionPhone: '0000',
  institutionWebsite: 'https://example.com',
  logoUrl: '/Logo_CNI.png',
  footerNote: 'Nota',
  signatureBlocks: [],
};

function buildSampleOrder() {
  const now = new Date('2026-03-01T12:00:00.000Z');
  return {
    id: 'ord-golden-1',
    organizationId: 'org-1',
    orderNumber: 'COM-CNI-2026-00042',
    sequenceNumber: 42,
    sequenceYear: 2026,
    purchaseReference: 'REF-2026-001',
    requestDate: now,
    requiredDate: new Date('2026-03-15T00:00:00.000Z'),
    requestedByName: 'María Golden',
    requesterJobTitle: 'Compras',
    requesterEmployeeId: null,
    createdById: 'user-1',
    supplierId: null,
    supplierName: 'Proveedor Golden SA',
    supplierRtn: '08019999999999',
    supplierPhone: '9999-9999',
    purchaseJustification: 'Compra de insumos para golden test',
    subtotal: new Prisma.Decimal(200),
    discountType: 'PORCENTAJE' as const,
    discountValue: new Prisma.Decimal(10),
    discount: new Prisma.Decimal(20),
    taxRate: new Prisma.Decimal(15),
    tax: new Prisma.Decimal(13.5),
    total: new Prisma.Decimal(193.5),
    status: 'GENERATED' as const,
    templateId: null,
    templateVersion: 1,
    generatedById: 'user-1',
    generatedAt: now,
    issuedById: null,
    issuedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: { id: 'user-1', firstName: 'María', lastName: 'Golden' },
    generatedBy: { id: 'user-1', firstName: 'María', lastName: 'Golden' },
    issuedBy: null,
    supplier: null,
    items: [
      {
        id: 'item-1',
        orderId: 'ord-golden-1',
        itemNumber: 1,
        description: 'Tóner',
        unit: 'UNIT',
        quantity: new Prisma.Decimal(2),
        unitPrice: new Prisma.Decimal(100),
        total: new Prisma.Decimal(200),
        taxProfile: 'GENERAL_15' as const,
        taxableBase: new Prisma.Decimal(180),
        taxAmount: new Prisma.Decimal(13.5),
        itemTotal: new Prisma.Decimal(193.5),
        taxes: [
          {
            id: 'tax-1',
            itemId: 'item-1',
            code: 'ISV_15',
            name: 'ISV 15%',
            rate: new Prisma.Decimal(15),
            taxableBase: new Prisma.Decimal(180),
            amount: new Prisma.Decimal(13.5),
            sortOrder: 0,
          },
        ],
      },
    ],
    documentos: [
      {
        id: 'doc-1',
        orderId: 'ord-golden-1',
        type: 'ORDER_PDF',
        name: 'pdf',
        originalName: 'orden.pdf',
        mimeType: 'application/pdf',
        size: 1000,
        storageKey: 'k',
        url: '/files/orden.pdf',
        version: 1,
        isActive: true,
        uploadedAt: now,
        uploadedBy: { id: 'user-1', firstName: 'María', lastName: 'Golden' },
      },
    ],
  };
}

describe('purchases golden — serialize / preview DTO', () => {
  it('serializePurchaseOrder coincide con fixture', () => {
    expect(serializePurchaseOrder(buildSampleOrder() as never)).toEqual(fixture.serialized);
  });

  it('buildPreviewDataFromInput coincide con fixture', () => {
    const preview = buildPreviewDataFromInput(
      {
        purchaseReference: 'REF-PREVIEW',
        requestDate: '2026-03-01',
        requiredDate: '2026-03-15',
        requestedByName: 'María Golden',
        requesterJobTitle: 'Compras',
        supplierName: 'Proveedor Golden SA',
        supplierRtn: '08019999999999',
        supplierPhone: '9999-9999',
        purchaseJustification: 'Preview golden',
        discountType: 'NINGUNO',
        discountValue: 0,
        taxRate: 15,
        items: [{ description: 'Item A', unit: 'UNIT', quantity: 2, unitPrice: 50, taxProfile: 'GENERAL_15' }],
      },
      template as never,
    );
    expect(preview).toEqual(fixture.preview);
  });
});
