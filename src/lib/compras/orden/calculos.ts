import { Prisma } from '@prisma/client';

export type PurchaseCalculationItem = {
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
};

export type PurchaseDiscountType = 'NINGUNO' | 'MONTO' | 'PORCENTAJE';

export type PurchaseCalculationInput = {
  items: PurchaseCalculationItem[];
  discountType: PurchaseDiscountType;
  discountValue: Prisma.Decimal;
  taxRate: Prisma.Decimal;
};

export function toDecimal(
  value: number | string | Prisma.Decimal | null | undefined,
  fallback: number | string = 0
): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    (typeof value === 'number' && !Number.isFinite(value))
  ) {
    return new Prisma.Decimal(fallback);
  }

  try {
    return new Prisma.Decimal(value);
  } catch {
    return new Prisma.Decimal(fallback);
  }
}

export function calculatePurchaseOrder(input: PurchaseCalculationInput) {
  const zero = new Prisma.Decimal(0);
  const hundred = new Prisma.Decimal(100);

  const lineTotals = input.items.map((item) =>
    item.quantity.mul(item.unitPrice).toDecimalPlaces(2)
  );

  const subtotal = lineTotals
    .reduce((sum, line) => sum.add(line), zero)
    .toDecimalPlaces(2);

  let requestedDiscount = zero;
  if (input.discountType === 'MONTO') requestedDiscount = input.discountValue;
  if (input.discountType === 'PORCENTAJE') {
    requestedDiscount = subtotal.mul(input.discountValue).div(hundred);
  }
  const discount = Prisma.Decimal.min(
    Prisma.Decimal.max(requestedDiscount, zero),
    subtotal
  ).toDecimalPlaces(2);

  const taxableBase = subtotal.sub(discount).toDecimalPlaces(2);

  const tax = taxableBase.mul(input.taxRate).div(hundred).toDecimalPlaces(2);

  const total = taxableBase.add(tax).toDecimalPlaces(2);

  return { lineTotals, subtotal, discount, tax, total, taxableBase };
}

export function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}
