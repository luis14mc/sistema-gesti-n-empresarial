import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  validatePurchaseOrderForGeneration,
  type PurchaseOrderWithItems,
} from '@/lib/compras/orden/generation-validation';

function validOrder(): PurchaseOrderWithItems {
  return {
    id: 'order-1',
    organizationId: 'org-a',
    version: 1,
    orderNumber: 'OC-2026-00001',
    sequenceNumber: 1,
    sequenceYear: 2026,
    purchaseReference: '',
    requestDate: new Date('2026-07-21'),
    requiredDate: new Date('2026-07-22'),
    requestedByName: 'Ana López',
    requesterJobTitle: 'Analista',
    supplierId: null,
    supplierName: 'Proveedor Uno',
    supplierRtn: '08011999123456',
    supplierPhone: '9999-9999',
    purchaseJustification: 'Compra necesaria para operaciones.',
    subtotal: new Prisma.Decimal(10),
    discountType: 'NINGUNO',
    discountValue: new Prisma.Decimal(0),
    discount: new Prisma.Decimal(0),
    taxRate: new Prisma.Decimal(15),
    tax: new Prisma.Decimal(1.5),
    total: new Prisma.Decimal(11.5),
    status: 'DRAFT',
    createdById: 'user-1',
    generatedById: null,
    generatedAt: null,
    issuedById: null,
    issuedAt: null,
    cancelledById: null,
    cancelledAt: null,
    cancellationReason: null,
    closedById: null,
    closedAt: null,
    templateId: null,
    templateVersion: null,
    templateSnapshot: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    items: [{
      id: 'item-1',
      orderId: 'order-1',
      itemNumber: 1,
      description: 'Producto',
      unit: 'UNIT',
      quantity: new Prisma.Decimal(1),
      unitPrice: new Prisma.Decimal(10),
      total: new Prisma.Decimal(10),
      createdAt: new Date(),
      updatedAt: new Date(),
    }],
  };
}

describe('validatePurchaseOrderForGeneration', () => {
  it.each([
    ['supplier RTN', (order: PurchaseOrderWithItems) => { order.supplierRtn = ''; }, 'proveedorRtn'],
    ['supplier phone', (order: PurchaseOrderWithItems) => { order.supplierPhone = ''; }, 'proveedorTelefono'],
    ['item description', (order: PurchaseOrderWithItems) => { order.items[0].description = ''; }, 'items.0.descripcion'],
    ['positive quantity', (order: PurchaseOrderWithItems) => { order.items[0].quantity = new Prisma.Decimal(0); }, 'items.0.cantidad'],
    ['valid unit price', (order: PurchaseOrderWithItems) => { order.items[0].unitPrice = new Prisma.Decimal(-1); }, 'items.0.precioUnitario'],
    ['justification', (order: PurchaseOrderWithItems) => { order.purchaseJustification = ''; }, 'justificacion'],
  ])('reports a missing or invalid %s', (_label, mutate, expectedField) => {
    const order = validOrder();
    mutate(order);
    expect(validatePurchaseOrderForGeneration(order)).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: expectedField })])
    );
  });

  it('rejects invalid and reversed dates', () => {
    const invalid = validOrder();
    invalid.requestDate = new Date('invalid');
    expect(validatePurchaseOrderForGeneration(invalid)).toContainEqual({
      field: 'fecha',
      message: 'La fecha de la orden no es válida.',
    });

    const reversed = validOrder();
    reversed.requiredDate = new Date('2026-07-20');
    expect(validatePurchaseOrderForGeneration(reversed)).toContainEqual({
      field: 'fechaRequerida',
      message: 'La fecha requerida no puede ser anterior a la fecha de la orden.',
    });
  });

  it('rejects invalid RTN format', () => {
    const order = validOrder();
    order.supplierRtn = '123';
    expect(validatePurchaseOrderForGeneration(order)).toContainEqual({
      field: 'proveedorRtn',
      message: 'El RTN debe tener 14 dígitos.',
    });
  });

  it('accepts a complete simplified draft without a purchase reference', () => {
    expect(validatePurchaseOrderForGeneration(validOrder())).toEqual([]);
  });
});
