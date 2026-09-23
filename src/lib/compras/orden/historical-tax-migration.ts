import { Prisma } from '@prisma/client';
import {
  calculatePurchaseOrder,
  toDecimal,
  type PurchaseTaxProfileId,
} from './calculos';

const SUPPORTED_RATES = new Set([0, 15, 18]);

export class HistoricalTaxMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HistoricalTaxMigrationError';
  }
}

export type HistoricalOrderTaxInput = {
  id?: string;
  taxRate: Prisma.Decimal | number | string;
  tax: Prisma.Decimal | number | string;
  discount: Prisma.Decimal | number | string;
  subtotal: Prisma.Decimal | number | string;
  total: Prisma.Decimal | number | string;
  items: Array<{
    id?: string;
    itemNumber: number;
    lineSubtotal: Prisma.Decimal | number | string;
  }>;
};

export type MigratedItemTax = {
  id?: string;
  itemNumber: number;
  taxProfile: PurchaseTaxProfileId;
  taxableBase: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  itemTotal: Prisma.Decimal;
  taxes: Array<{
    code: string;
    name: string;
    rate: Prisma.Decimal;
    taxableBase: Prisma.Decimal;
    amount: Prisma.Decimal;
    sortOrder: number;
  }>;
};

function profileForRate(rate: number): PurchaseTaxProfileId {
  if (rate === 0) return 'EXEMPT';
  if (rate === 15) return 'GENERAL_15';
  if (rate === 18) return 'ISV_18';
  throw new HistoricalTaxMigrationError(`UNSUPPORTED_HISTORICAL_TAX_RATE:${rate}`);
}

function assertMoneyEqual(actual: Prisma.Decimal, expected: Prisma.Decimal, label: string, orderId: string) {
  if (!actual.equals(expected)) {
    throw new HistoricalTaxMigrationError(
      `${label} mismatch for order ${orderId}: migrated ${actual.toFixed(2)} stored ${expected.toFixed(2)}`,
    );
  }
}

/**
 * Converts one historical order-level tax snapshot into item tax rows.
 * Uses calculatePurchaseOrder for the discount split and tax math, then
 * moves any cent remainder onto the largest taxable line so stored totals stay exact.
 */
export function migrateHistoricalOrderTaxes(order: HistoricalOrderTaxInput): MigratedItemTax[] {
  const orderId = order.id ?? 'unknown';
  const rate = toDecimal(order.taxRate);
  const storedTax = toDecimal(order.tax).toDecimalPlaces(2);
  const storedDiscount = toDecimal(order.discount).toDecimalPlaces(2);
  const storedSubtotal = toDecimal(order.subtotal).toDecimalPlaces(2);
  const storedTotal = toDecimal(order.total).toDecimalPlaces(2);
  const rateNumber = rate.toNumber();

  if (!SUPPORTED_RATES.has(rateNumber)) {
    throw new HistoricalTaxMigrationError(`UNSUPPORTED_HISTORICAL_TAX_RATE:${rateNumber} order ${orderId}`);
  }
  if (storedDiscount.isNegative() || storedDiscount.greaterThan(storedSubtotal)) {
    throw new HistoricalTaxMigrationError(`INVALID_HISTORICAL_DISCOUNT order ${orderId}`);
  }

  const items = [...order.items].sort((a, b) => a.itemNumber - b.itemNumber);
  if (items.length === 0) {
    if (storedSubtotal.isZero() && storedDiscount.isZero() && storedTax.isZero() && storedTotal.isZero()) {
      return [];
    }
    throw new HistoricalTaxMigrationError(`HISTORICAL_ORDER_WITHOUT_ITEMS order ${orderId}`);
  }

  const lineSubtotals = items.map((item) => toDecimal(item.lineSubtotal).toDecimalPlaces(2));
  const lineSum = lineSubtotals.reduce((sum, line) => sum.add(line), new Prisma.Decimal(0)).toDecimalPlaces(2);
  assertMoneyEqual(lineSum, storedSubtotal, 'line subtotal', orderId);

  const profile = profileForRate(rateNumber);
  const calculated = calculatePurchaseOrder({
    discountType: 'MONTO',
    discountValue: storedDiscount,
    items: items.map((item, index) => ({
      quantity: 1,
      unitPrice: lineSubtotals[index],
      taxProfile: profile,
    })),
  });

  assertMoneyEqual(calculated.discount, storedDiscount, 'allocated discount', orderId);
  assertMoneyEqual(calculated.subtotal, storedSubtotal, 'subtotal', orderId);

  const drift = storedTax.sub(calculated.tax);
  const tolerance = Prisma.Decimal.max(new Prisma.Decimal('0.02'), new Prisma.Decimal(items.length).mul('0.01'));
  if (drift.abs().greaterThan(tolerance)) {
    throw new HistoricalTaxMigrationError(
      `HISTORICAL_TAX_DRIFT order ${orderId}: ${drift.toFixed(2)} exceeds ${tolerance.toFixed(2)}`,
    );
  }

  let remainderIndex = 0;
  calculated.items.forEach((item, index) => {
    if (item.taxableBase.greaterThan(calculated.items[remainderIndex].taxableBase)) {
      remainderIndex = index;
    }
  });

  return calculated.items.map((item, index) => {
    const taxAmount = item.taxAmount.add(index === remainderIndex ? drift : 0).toDecimalPlaces(2);
    if (taxAmount.isNegative()) {
      throw new HistoricalTaxMigrationError(`NEGATIVE_MIGRATED_TAX order ${orderId}`);
    }
    const taxes = item.taxes.map((taxLine) => ({
      ...taxLine,
      amount: taxLine.amount.add(index === remainderIndex && item.taxes.length === 1 ? drift : 0).toDecimalPlaces(2),
    }));
    if (item.taxes.length !== 1 && !drift.isZero() && index === remainderIndex) {
      throw new HistoricalTaxMigrationError(`CANNOT_PLACE_TAX_REMAINDER order ${orderId}`);
    }
    const itemTotal = item.taxableBase.add(taxAmount).toDecimalPlaces(2);
    return {
      id: items[index].id,
      itemNumber: items[index].itemNumber,
      taxProfile: profile,
      taxableBase: item.taxableBase,
      taxAmount,
      itemTotal,
      taxes: profile === 'EXEMPT' ? [] : taxes,
    };
  }).map((item, _index, all) => {
    if (_index === all.length - 1) {
      const taxSum = all.reduce((sum, row) => sum.add(row.taxAmount), new Prisma.Decimal(0)).toDecimalPlaces(2);
      const totalSum = all.reduce((sum, row) => sum.add(row.itemTotal), new Prisma.Decimal(0)).toDecimalPlaces(2);
      assertMoneyEqual(taxSum, storedTax, 'tax', orderId);
      const expectedTotal = storedSubtotal.sub(storedDiscount).add(storedTax).toDecimalPlaces(2);
      assertMoneyEqual(expectedTotal, storedTotal, 'order total identity', orderId);
      assertMoneyEqual(totalSum, storedTotal, 'item total', orderId);
    }
    return item;
  });
}
