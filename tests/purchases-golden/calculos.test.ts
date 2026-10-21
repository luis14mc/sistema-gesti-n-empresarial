import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { calcularTotalesCompra } from '@/lib/compras/calculos';
import { calculatePurchaseOrder, decimalToNumber } from '@/lib/compras/orden/calculos';
import fixture from './__fixtures__/calculos.json';

describe('purchases golden — cálculos', () => {
  it('calculos.ts legacy: totales al centavo', () => {
    for (const row of fixture.legacyCases) {
      const result = calcularTotalesCompra({
        items: row.items,
        descuento: row.descuento,
        impuestoTasa: row.impuestoTasa,
      });
      expect(result).toEqual(row.expected);
    }
  });

  it('orden/calculos.ts: totales con perfiles de impuesto y descuento', () => {
    const input = fixture.orderInput;
    const result = calculatePurchaseOrder({
      items: input.items.map((item) => ({
        quantity: new Prisma.Decimal(String(item.quantity)),
        unitPrice: new Prisma.Decimal(String(item.unitPrice)),
        taxProfile: item.taxProfile as 'GENERAL_15' | 'EXEMPT',
      })),
      discountType: input.discountType as 'PORCENTAJE',
      discountValue: input.discountValue,
      taxRate: input.taxRate,
    });

    expect(decimalToNumber(result.subtotal)).toBe(fixture.orderExpected.subtotal);
    expect(decimalToNumber(result.discount)).toBe(fixture.orderExpected.discount);
    expect(decimalToNumber(result.taxableBase)).toBe(fixture.orderExpected.taxableBase);
    expect(decimalToNumber(result.tax)).toBe(fixture.orderExpected.tax);
    expect(decimalToNumber(result.total)).toBe(fixture.orderExpected.total);
    expect(decimalToNumber(result.exemptBase)).toBe(fixture.orderExpected.exemptBase);
    expect(result.items.map((i) => decimalToNumber(i.itemTotal))).toEqual(fixture.orderExpected.itemTotals);
  });
});
