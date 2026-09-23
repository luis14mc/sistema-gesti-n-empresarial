import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { calculatePurchaseOrder, toDecimal } from '../src/lib/compras/orden/calculos';
import { formatOrderNumber } from '../src/lib/compras/orden/numbering';
import { canOrdenAction } from '../src/lib/compras/orden/permissions';
import { buildPreviewDataFromInput } from '../src/lib/compras/orden/preview-data';
import type { PurchaseOrderTemplateConfig } from '../src/lib/compras/orden/template-config';
import { createPurchaseOrderSchema, normalizePurchaseOrderPayload } from '../src/lib/compras/orden/schemas';

const template: PurchaseOrderTemplateConfig = {
  id: 'template-1',
  version: 1,
  institutionName: 'CNI',
  documentTitle: 'Orden de compra',
  orderPrefix: 'OC',
  signatureTitle: 'Autorizado por',
  primaryColor: '#003366',
  secondaryColor: '#eeeeee',
  showInstitutionAddress: false,
  showInstitutionPhone: false,
  showInstitutionWebsite: false,
  showInstitutionRtn: false,
  showReference: true,
  showRequiredDate: true,
};

describe('calculatePurchaseOrder', () => {
  const items = [
    { quantity: toDecimal(2), unitPrice: toDecimal(100), taxProfile: 'GENERAL_15' as const },
    { quantity: toDecimal(1), unitPrice: toDecimal(50), taxProfile: 'GENERAL_15' as const },
  ];

  it('calcula subtotal', () => {
    const r = calculatePurchaseOrder({
      items,
      discountType: 'NINGUNO',
      discountValue: toDecimal(0),
    });
    expect(r.subtotal.toNumber()).toBe(250);
  });

  it('limita descuento al subtotal', () => {
    const r = calculatePurchaseOrder({
      items,
      discountType: 'MONTO',
      discountValue: toDecimal(500),
    });
    expect(r.discount.toNumber()).toBe(250);
    expect(r.total.toNumber()).toBe(0);
  });

  it('calcula impuesto sobre base imponible', () => {
    const r = calculatePurchaseOrder({
      items,
      discountType: 'MONTO',
      discountValue: toDecimal(10),
    });
    expect(r.tax.toNumber()).toBe(36);
    expect(r.total.toNumber()).toBe(276);
  });

  it.each([
    ['EXEMPT', 0, 9000],
    ['GENERAL_15', 1350, 10350],
    ['ISV_18', 1620, 10620],
  ] as const)('calcula %s después de un descuento fijo', (taxProfile, expectedTax, expectedTotal) => {
    const r = calculatePurchaseOrder({
      items: [{ quantity: toDecimal(1), unitPrice: toDecimal(10000), taxProfile }],
      discountType: 'MONTO',
      discountValue: toDecimal(1000),
    });
    expect(r.discount.toNumber()).toBe(1000);
    expect(r.taxableBase.toNumber()).toBe(9000);
    expect(r.tax.toNumber()).toBe(expectedTax);
    expect(r.total.toNumber()).toBe(expectedTotal);
  });

  it('calcula descuento porcentual con Decimal', () => {
    const r = calculatePurchaseOrder({
      items: [{ quantity: toDecimal(2), unitPrice: toDecimal('5000'), taxProfile: 'GENERAL_15' }],
      discountType: 'PORCENTAJE',
      discountValue: toDecimal(10),
    });
    expect(r.discount.toNumber()).toBe(1000);
    expect(r.taxableBase.toNumber()).toBe(9000);
    expect(r.total.toNumber()).toBe(10350);
  });

  it('ignora el valor cuando no aplica descuento', () => {
    const r = calculatePurchaseOrder({
      items,
      discountType: 'NINGUNO',
      discountValue: toDecimal(100),
    });
    expect(r.discount.toNumber()).toBe(0);
  });
});

describe('purchase order calculation schema', () => {
  const base = {
    purchaseReference: '',
    requestDate: '2026-07-21',
    requiredDate: '2026-07-22',
    requestedByName: 'Ana López',
    requesterJobTitle: 'Analista',
    supplierName: 'Proveedor',
    supplierRtn: '08011999123456',
    supplierPhone: '9999-9999',
    purchaseJustification: 'Compra necesaria para operaciones.',
    items: [{ description: 'Producto', unit: 'UNIT', quantity: 1, unitPrice: 100 }],
  } as const;

  it.each(['EXEMPT', 'GENERAL_15', 'ISV_18'] as const)('acepta el tratamiento %s', (taxProfile) => {
    expect(createPurchaseOrderSchema.safeParse({
      ...base,
      discountType: 'NINGUNO',
      discountValue: 0,
      items: [{ description: 'Producto', unit: 'UNIT', quantity: 1, unitPrice: 100, taxProfile }],
    }).success).toBe(true);
  });

  it('rechaza impuestos personalizados y descuentos inválidos', () => {
    expect(createPurchaseOrderSchema.safeParse({
      ...base,
      discountType: 'NINGUNO',
      discountValue: 0,
      items: [{
        description: 'Producto',
        unit: 'UNIT',
        quantity: 1,
        unitPrice: 100,
        taxProfile: 'CUSTOM',
        customTaxes: [{ code: 'MUNICIPAL', name: 'Tasa municipal', rate: 150 }],
      }],
    }).success).toBe(false);
    expect(createPurchaseOrderSchema.safeParse({ ...base, discountType: 'PORCENTAJE', discountValue: 101 }).success).toBe(false);
    expect(createPurchaseOrderSchema.safeParse({ ...base, discountType: 'MONTO', discountValue: 101 }).success).toBe(false);
  });

  it('normaliza un descuento legado y descarta la tasa de la orden', () => {
    const normalized = normalizePurchaseOrderPayload({ discount: 25, taxRate: 15 });
    expect(normalized).toMatchObject({
      discountType: 'MONTO',
      discountValue: 25,
    });
    expect(normalized).not.toHaveProperty('taxRate');
  });
});

describe('formatOrderNumber', () => {
  it('formatea COM-CNI-2026-00001', () => {
    expect(formatOrderNumber('COM-CNI', 2026, 1)).toBe('COM-CNI-2026-00001');
    expect(formatOrderNumber('COM-CNI', 2026, 42)).toBe('COM-CNI-2026-00042');
  });
});

describe('canOrdenAction', () => {
  it('permite editar borrador al perfil administrativo, no a TI', () => {
    expect(canOrdenAction('ADMINISTRACION', 'update', { isCreator: true, status: 'DRAFT' })).toBe(true);
    expect(canOrdenAction('IT', 'update', { isCreator: true, status: 'DRAFT' })).toBe(false);
    expect(canOrdenAction('IT_MANAGER', 'update', { isCreator: true, status: 'DRAFT' })).toBe(false);
  });

  it('impide editar orden emitida', () => {
    expect(canOrdenAction('ADMIN', 'update', { status: 'ISSUED' })).toBe(false);
  });

  it('impide anular cerrada', () => {
    expect(canOrdenAction('ADMIN', 'anular', { status: 'CLOSED' })).toBe(false);
  });

  it('restringe emitir a perfiles con aprobación, solo en GENERATED', () => {
    expect(canOrdenAction('ADMINISTRACION', 'emitir', { status: 'GENERATED' })).toBe(true);
    expect(canOrdenAction('ADMIN', 'emitir', { status: 'GENERATED' })).toBe(true);
    expect(canOrdenAction('PROCUREMENT', 'emitir', { status: 'GENERATED' })).toBe(false);
    expect(canOrdenAction('ADMINISTRACION', 'emitir', { status: 'DRAFT' })).toBe(false);
    expect(canOrdenAction('ADMIN', 'emitir', { status: 'ISSUED' })).toBe(false);
  });
});

describe('Prisma Decimal', () => {
  it('multiplica correctamente', () => {
    const total = toDecimal(3).mul(toDecimal(10.5));
    expect(total.toDecimalPlaces(2).toNumber()).toBe(31.5);
  });

  it.each([
    [undefined, 0],
    [null, 0],
    ['', 0],
    [Number.NaN, 0],
    [0, 0],
    ['25.50', 25.5],
  ])('normaliza %s a un Decimal válido', (value, expected) => {
    expect(toDecimal(value).toNumber()).toBe(expected);
  });

  it('preserva el valor de una instancia Decimal', () => {
    const decimal = new Prisma.Decimal(10);
    expect(toDecimal(decimal).toNumber()).toBe(10);
  });
});

describe('buildPreviewDataFromInput', () => {
  it('tolera una fila de ítem incompleta sin lanzar DecimalError', () => {
    const preview = buildPreviewDataFromInput({
      items: [{
        description: '',
        unit: undefined,
        quantity: undefined,
        unitPrice: undefined,
      }],
    }, template);

    expect(preview.items[0]).toMatchObject({
      itemNumber: 1,
      description: '',
      unit: 'UNIT',
      quantity: 0,
      unitPrice: 0,
      total: 0,
      taxAmount: 0,
      itemTotal: 0,
    });
    expect(preview.subtotal).toBe(0);
    expect(preview.total).toBe(0);
  });
});
