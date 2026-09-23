import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  HistoricalTaxMigrationError,
  migrateHistoricalOrderTaxes,
} from '@/lib/compras/orden/historical-tax-migration';

function money(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

function historicalOrder(input: {
  taxRate: 0 | 15 | 18;
  discount: Prisma.Decimal.Value;
  lines: Array<{ itemNumber: number; quantity: Prisma.Decimal.Value; unitPrice: Prisma.Decimal.Value }>;
}) {
  const items = input.lines.map((line) => ({
    itemNumber: line.itemNumber,
    lineSubtotal: money(line.quantity).mul(line.unitPrice).toDecimalPlaces(2),
  }));
  const subtotal = items.reduce((sum, item) => sum.add(item.lineSubtotal), new Prisma.Decimal(0)).toDecimalPlaces(2);
  const discount = money(input.discount);
  const tax = subtotal.sub(discount).mul(input.taxRate).div(100).toDecimalPlaces(2);
  const total = subtotal.sub(discount).add(tax).toDecimalPlaces(2);
  return { taxRate: input.taxRate, tax, discount, subtotal, total, items };
}

function expectPreservedTotals(order: ReturnType<typeof historicalOrder>) {
  const migrated = migrateHistoricalOrderTaxes(order);
  const tax = migrated.reduce((sum, item) => sum.add(item.taxAmount), new Prisma.Decimal(0)).toDecimalPlaces(2);
  const total = migrated.reduce((sum, item) => sum.add(item.itemTotal), new Prisma.Decimal(0)).toDecimalPlaces(2);
  expect(tax.equals(order.tax)).toBe(true);
  expect(total.equals(order.total)).toBe(true);
  return migrated;
}

describe('migrateHistoricalOrderTaxes', () => {
  it('migrates a 15% order without discount to GENERAL_15', () => {
    const order = historicalOrder({
      taxRate: 15,
      discount: 0,
      lines: [
        { itemNumber: 1, quantity: 2, unitPrice: 100 },
        { itemNumber: 2, quantity: 1, unitPrice: 50 },
      ],
    });
    const migrated = expectPreservedTotals(order);
    expect(migrated.every((item) => item.taxProfile === 'GENERAL_15')).toBe(true);
    expect(migrated[0].taxes[0]?.code).toBe('ISV_15');
    expect(order.tax.toNumber()).toBe(37.5);
    expect(order.total.toNumber()).toBe(287.5);
  });

  it('migrates an 18% order to ISV_18', () => {
    const order = historicalOrder({
      taxRate: 18,
      discount: 0,
      lines: [{ itemNumber: 1, quantity: 1, unitPrice: 8000 }],
    });
    const migrated = expectPreservedTotals(order);
    expect(migrated[0].taxProfile).toBe('ISV_18');
    expect(migrated[0].taxes[0]?.code).toBe('ISV_18');
    expect(order.tax.toNumber()).toBe(1440);
    expect(order.total.toNumber()).toBe(9440);
  });

  it('migrates a 0% order as exempt with no tax rows', () => {
    const order = historicalOrder({
      taxRate: 0,
      discount: 0,
      lines: [{ itemNumber: 1, quantity: 3, unitPrice: 40 }],
    });
    const migrated = expectPreservedTotals(order);
    expect(migrated[0].taxProfile).toBe('EXEMPT');
    expect(migrated[0].taxes).toEqual([]);
    expect(migrated[0].taxAmount.toNumber()).toBe(0);
    expect(order.total.toNumber()).toBe(120);
  });

  it('migrates a 15% order with a fixed discount', () => {
    const order = historicalOrder({
      taxRate: 15,
      discount: 10,
      lines: [
        { itemNumber: 1, quantity: 2, unitPrice: 100 },
        { itemNumber: 2, quantity: 1, unitPrice: 50 },
      ],
    });
    const migrated = expectPreservedTotals(order);
    expect(migrated.every((item) => item.taxProfile === 'GENERAL_15')).toBe(true);
    expect(order.tax.toNumber()).toBe(36);
    expect(order.total.toNumber()).toBe(276);
  });

  it('migrates mixed quantities with a percentage discount allocated as a stored amount', () => {
    const lines = [
      { itemNumber: 1, quantity: 3, unitPrice: '10.33' },
      { itemNumber: 2, quantity: 2, unitPrice: 75 },
      { itemNumber: 3, quantity: 1, unitPrice: '19.99' },
    ];
    const subtotal = lines.reduce(
      (sum, line) => sum.add(money(line.quantity).mul(line.unitPrice).toDecimalPlaces(2)),
      new Prisma.Decimal(0),
    ).toDecimalPlaces(2);
    const discount = subtotal.mul(10).div(100).toDecimalPlaces(2);
    const order = historicalOrder({ taxRate: 15, discount, lines });
    const migrated = expectPreservedTotals(order);
    expect(migrated).toHaveLength(3);
    expect(migrated.every((item) => item.taxProfile === 'GENERAL_15')).toBe(true);
  });

  it('fails an unsupported historical rate instead of leaving a legacy order', () => {
    expect(() => migrateHistoricalOrderTaxes({
      id: 'order-bad',
      taxRate: 12,
      tax: 12,
      discount: 0,
      subtotal: 100,
      total: 112,
      items: [{ itemNumber: 1, lineSubtotal: 100 }],
    })).toThrow(HistoricalTaxMigrationError);
  });
});
