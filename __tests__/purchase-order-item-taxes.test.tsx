import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PurchaseOrderDocument } from '@/components/compras/document/PurchaseOrderDocument';
import {
  calculatePurchaseOrder,
  calculatePurchaseOrderItem,
  toDecimal,
} from '@/lib/compras/orden/calculos';
import { buildPreviewDataFromInput, buildPreviewDataFromSerializedOrder } from '@/lib/compras/orden/preview-data';
import type { PurchaseOrderTemplateConfig } from '@/lib/compras/orden/template-config';

const format: PurchaseOrderTemplateConfig = {
  id: 'tpl-1',
  version: 1,
  logoUrl: null,
  institutionName: 'Consejo Nacional de Inversiones',
  institutionAddress: '',
  institutionPhone: '',
  institutionWebsite: '',
  institutionRtn: '',
  documentTitle: 'SOLICITUD Y ORDEN DE COMPRA',
  signatureTitle: 'Jefe de Presupuesto',
  orderPrefix: 'COM-CNI',
  footerText: '',
  additionalNote: '',
  primaryColor: '#123456',
  secondaryColor: '#abcdef',
  showInstitutionAddress: false,
  showInstitutionPhone: false,
  showInstitutionWebsite: false,
  showInstitutionRtn: false,
  showReference: true,
  showRequiredDate: true,
};

function line(profile: 'GENERAL_15' | 'EXEMPT' | 'ISV_18' | 'HOTEL_15_TOURISM_4', unitPrice: number, quantity = 1) {
  return calculatePurchaseOrderItem({
    quantity,
    unitPrice,
    taxProfile: profile,
  });
}

describe('item-level purchase taxes', () => {
  it('calculates GENERAL_15, EXEMPT, ISV_18 and hotel tourism', () => {
    expect(line('GENERAL_15', 100).taxAmount.toNumber()).toBe(15);
    expect(line('GENERAL_15', 100).itemTotal.toNumber()).toBe(115);
    expect(line('EXEMPT', 100).taxAmount.toNumber()).toBe(0);
    expect(line('EXEMPT', 100).itemTotal.toNumber()).toBe(100);
    expect(line('ISV_18', 100).taxAmount.toNumber()).toBe(18);
    expect(line('ISV_18', 100).itemTotal.toNumber()).toBe(118);

    const hotel = line('HOTEL_15_TOURISM_4', 100);
    expect(hotel.taxes.map((tax) => tax.amount.toNumber())).toEqual([15, 4]);
    expect(hotel.itemTotal.toNumber()).toBe(119);
  });

  it('calculates a mixed order and groups the tax summary', () => {
    const result = calculatePurchaseOrder({
      discountType: 'NINGUNO',
      discountValue: 0,
      items: [
        { quantity: 1, unitPrice: 20000, taxProfile: 'GENERAL_15' },
        { quantity: 1, unitPrice: 8000, taxProfile: 'ISV_18' },
        { quantity: 1, unitPrice: 5000, taxProfile: 'EXEMPT' },
        { quantity: 1, unitPrice: 10000, taxProfile: 'HOTEL_15_TOURISM_4' },
      ],
    });

    expect(result.items.map((item) => item.taxAmount.toNumber())).toEqual([3000, 1440, 0, 1900]);
    expect(result.items.map((item) => item.itemTotal.toNumber())).toEqual([23000, 9440, 5000, 11900]);
    expect(result.subtotal.toNumber()).toBe(43000);
    expect(result.tax.toNumber()).toBe(6340);
    expect(result.total.toNumber()).toBe(49340);
    expect(result.exemptBase.toNumber()).toBe(5000);
    expect(result.taxSummary.map((line) => ({
      code: line.code,
      taxableBase: line.taxableBase.toNumber(),
      amount: line.amount.toNumber(),
    }))).toEqual([
      { code: 'ISV_15', taxableBase: 30000, amount: 4500 },
      { code: 'ISV_18', taxableBase: 8000, amount: 1440 },
      { code: 'TOURISM_4', taxableBase: 10000, amount: 400 },
    ]);
  });

  it('taxes quantity times unit price and rounds cents', () => {
    const quantityLine = line('GENERAL_15', 100, 3);
    expect(quantityLine.taxableBase.toNumber()).toBe(300);
    expect(quantityLine.taxAmount.toNumber()).toBe(45);

    const cents = calculatePurchaseOrderItem({
      quantity: 1,
      unitPrice: '10.33',
      taxProfile: 'GENERAL_15',
    });
    expect(cents.taxableBase.toNumber()).toBe(10.33);
    expect(cents.taxAmount.toNumber()).toBe(1.55);
    expect(cents.itemTotal.toNumber()).toBe(11.88);
  });

  it('ignores a tampered tax amount and recalculates from the rate', () => {
    const result = calculatePurchaseOrder({
      discountType: 'NINGUNO',
      discountValue: 0,
      items: [{
        quantity: 1,
        unitPrice: 100,
        taxProfile: 'CUSTOM',
        customTaxes: [{ code: 'MUNICIPAL', name: 'Tasa municipal', rate: 3, amount: 999 }],
      }],
    });
    expect(result.tax.toNumber()).toBe(3);
    expect(result.total.toNumber()).toBe(103);
  });

  it('keeps a legacy order without item taxes on the order-level ISV', () => {
    const preview = buildPreviewDataFromSerializedOrder({
      purchaseReference: 'REF',
      requestDate: '2026-09-01T00:00:00.000Z',
      requiredDate: '2026-09-02T00:00:00.000Z',
      requestedByName: 'Ana',
      requesterJobTitle: 'Analista',
      supplierName: 'Proveedor',
      supplierRtn: '08011999123456',
      supplierPhone: '2222-0000',
      purchaseJustification: 'Compra',
      subtotal: 100,
      discount: 0,
      taxRate: 15,
      tax: 15,
      total: 115,
      status: 'GENERATED',
      items: [{ itemNumber: 1, description: 'Papel', unit: 'UNIT', quantity: 1, unitPrice: 100, total: 100 }],
    }, format);

    expect(preview.usesItemTaxes).toBe(false);
    expect(preview.taxSummary).toEqual([
      expect.objectContaining({ name: 'ISV 15%', amount: 15, taxableBase: 100 }),
    ]);
    const html = renderToStaticMarkup(<PurchaseOrderDocument order={preview} format={format} />);
    expect(html).toContain('ISV 15%');
    expect(html).toContain('Yenfri Garcia');
    expect(html).toContain('Lila Rivera');
  });

  it('prints mixed tax treatments and the tax summary', () => {
    const preview = buildPreviewDataFromInput({
      purchaseReference: 'REF',
      requestDate: '2026-09-01',
      requiredDate: '2026-09-10',
      requestedByName: 'Ana',
      requesterJobTitle: 'Analista',
      supplierName: 'Proveedor',
      supplierRtn: '08011999123456',
      supplierPhone: '2222-0000',
      purchaseJustification: 'Compra mixta',
      discountType: 'NINGUNO',
      discountValue: 0,
      items: [
        { description: 'Laptop', unit: 'UNIT', quantity: 1, unitPrice: 20000, taxProfile: 'GENERAL_15' },
        { description: 'Boleto', unit: 'SERVICE', quantity: 1, unitPrice: 8000, taxProfile: 'ISV_18' },
        { description: 'Exento', unit: 'SERVICE', quantity: 1, unitPrice: 5000, taxProfile: 'EXEMPT' },
        { description: 'Hotel', unit: 'SERVICE', quantity: 1, unitPrice: 10000, taxProfile: 'HOTEL_15_TOURISM_4' },
      ],
    }, format);
    const html = renderToStaticMarkup(<PurchaseOrderDocument order={preview} format={format} />);
    expect(html).toContain('ISV 15%');
    expect(html).toContain('ISV 18%');
    expect(html).toContain('Exento');
    expect(html).toContain('Tasa de Servicios Turísticos 4%');
    expect(html).toContain('RESUMEN TRIBUTARIO');
    expect(html).toContain('Base exenta');
    expect(html).toContain('L 49,340.00');
    expect(html).toContain('Yenfri Garcia');
    expect(html).toContain('Lila Rivera');
    expect(preview.total).toBe(49340);
  });
});

describe('decimal tax helpers stay finite', () => {
  it('rejects a negative custom rate', () => {
    expect(() => calculatePurchaseOrder({
      discountType: 'NINGUNO',
      discountValue: toDecimal(0),
      items: [{
        quantity: 1,
        unitPrice: 100,
        taxProfile: 'CUSTOM',
        customTaxes: [{ code: 'BAD', name: 'Negativo', rate: -1 }],
      }],
    })).toThrow('INVALID_TAX_RATE');
  });
});
