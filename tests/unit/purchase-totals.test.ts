// Phase 10B — domain unit tests for purchase totals.
import { describe, expect, it } from 'vitest';
import { calcularLineaTotal, calcularTotalesCompra } from '@/lib/compras/calculos';
import { COMPRA_IMPUESTO_TASA } from '@/lib/compras/constants';

describe('calcularLineaTotal', () => {
  it('multiplies quantity by unit price and rounds to two decimals', () => {
    expect(calcularLineaTotal(2, 100)).toBe(200);
    // 1.5 * 33.33 = 49.995, which rounds to 50.00 with two-decimal rounding.
    expect(calcularLineaTotal(1.5, 33.33)).toBe(50);
    expect(calcularLineaTotal(3, 0.1 + 0.2)).toBeCloseTo(0.9, 2);
  });

  it('returns 0 when quantity is 0', () => {
    expect(calcularLineaTotal(0, 100)).toBe(0);
  });
});

describe('calcularTotalesCompra', () => {
  it('computes subtotal, discount, tax, and total for a simple order', () => {
    const result = calcularTotalesCompra({
      items: [
        { cantidad: 2, precioUnitario: 100 },
        { cantidad: 1, precioUnitario: 50 },
      ],
      descuento: 50,
    });
    expect(result.subtotal).toBe(250);
    expect(result.descuento).toBe(50);
    expect(result.impuesto).toBe(Math.round(200 * COMPRA_IMPUESTO_TASA * 100) / 100);
    expect(result.total).toBe(Math.round((200 + result.impuesto) * 100) / 100);
  });

  it('clamps a negative discount to 0', () => {
    const result = calcularTotalesCompra({
      items: [{ cantidad: 1, precioUnitario: 100 }],
      descuento: -10,
    });
    expect(result.descuento).toBe(0);
  });

  it('clamps a discount that exceeds the subtotal to the subtotal value', () => {
    const result = calcularTotalesCompra({
      items: [{ cantidad: 1, precioUnitario: 100 }],
      descuento: 500,
    });
    expect(result.descuento).toBe(100);
    const base = result.subtotal - result.descuento;
    expect(base).toBe(0);
    expect(result.impuesto).toBe(0);
    expect(result.total).toBe(0);
  });

  it('honours an explicit tax rate', () => {
    const result = calcularTotalesCompra({
      items: [{ cantidad: 1, precioUnitario: 100 }],
      impuestoTasa: 0.18,
    });
    expect(result.impuesto).toBe(18);
    expect(result.total).toBe(118);
  });

  it('returns the per-line totals in the same order as the input', () => {
    const result = calcularTotalesCompra({
      items: [
        { cantidad: 2, precioUnitario: 100 },
        { cantidad: 3, precioUnitario: 25 },
      ],
    });
    expect(result.lineTotals).toEqual([200, 75]);
  });
});
