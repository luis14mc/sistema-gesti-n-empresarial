import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { validatePurchaseOrderForGeneration } from '@/modules/purchases/domain/generation-validation';
import { validatePurchaseDocumentFile } from '@/modules/purchases/domain/document-validation';
import fixture from './__fixtures__/validation.json';

const baseOrder = {
  orderNumber: 'COM-CNI-2026-00001',
  requestDate: new Date('2026-01-15'),
  requiredDate: new Date('2026-01-20'),
  requestedByName: 'Ana Test',
  requesterJobTitle: 'Analista',
  supplierName: 'Proveedor SA',
  supplierRtn: '08019999999999',
  purchaseJustification: 'Justificación válida de prueba',
  taxRate: new Prisma.Decimal(15),
  discountType: 'NINGUNO' as const,
  discountValue: new Prisma.Decimal(0),
  items: [
    {
      description: 'Item 1',
      unit: 'UNIDAD',
      quantity: new Prisma.Decimal(1),
      unitPrice: new Prisma.Decimal(10),
      taxProfile: 'GENERAL_15' as const,
      taxAmount: new Prisma.Decimal(1.5),
    },
  ],
};

describe('purchases golden — validación', () => {
  it('orden válida para generación no reporta errores', () => {
    expect(validatePurchaseOrderForGeneration(baseOrder as never)).toEqual(fixture.validErrors);
  });

  it('orden inválida: mensajes exactos por campo', () => {
    const errors = validatePurchaseOrderForGeneration({
      ...baseOrder,
      orderNumber: '',
      supplierRtn: '123',
      purchaseJustification: 'corta',
      requiredDate: new Date('2026-01-01'),
      items: [],
    } as never);
    expect(errors).toEqual(fixture.invalidErrors);
  });

  it('document-validation: archivos permitidos y rechazados', () => {
    expect(validatePurchaseDocumentFile(new File(['x'], 'doc.pdf', { type: 'application/pdf' }))).toBe(
      fixture.documentValid,
    );
    expect(validatePurchaseDocumentFile(new File(['x'], 'evil.exe', { type: 'application/octet-stream' }))).toBe(
      fixture.documentInvalidExe,
    );
    expect(validatePurchaseDocumentFile(new File([], 'empty.pdf', { type: 'application/pdf' }))).toBe(
      fixture.documentEmptyMessage,
    );
  });
});
