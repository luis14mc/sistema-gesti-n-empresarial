import { Prisma } from '@prisma/client';

export const MAX_TAX_RATE = 100;

export const PURCHASE_TAX_PROFILES = {
  GENERAL_15: [{ code: 'ISV_15', name: 'ISV 15%', rate: 15 }],
  EXEMPT: [],
  ISV_18: [{ code: 'ISV_18', name: 'ISV 18%', rate: 18 }],
  HOTEL_15_TOURISM_4: [
    { code: 'ISV_15', name: 'ISV 15%', rate: 15 },
    { code: 'TOURISM_4', name: 'Tasa de Servicios Turísticos 4%', rate: 4 },
  ],
} as const;

export const PURCHASE_TAX_PROFILE_OPTIONS = [
  { value: 'GENERAL_15', label: 'General — ISV 15%' },
  { value: 'EXEMPT', label: 'Exento / no gravado' },
  { value: 'ISV_18', label: 'ISV 18%' },
  { value: 'HOTEL_15_TOURISM_4', label: 'Hospedaje — ISV 15% + Tasa turística 4%' },
  { value: 'CUSTOM', label: 'Personalizado' },
] as const;

export type PurchaseTaxProfileId = keyof typeof PURCHASE_TAX_PROFILES | 'CUSTOM';

export type PurchaseDiscountType = 'NINGUNO' | 'MONTO' | 'PORCENTAJE';

export type PurchaseTaxComponentInput = {
  code: string;
  name: string;
  rate: number | string | Prisma.Decimal;
  amount?: number | string | Prisma.Decimal;
};

export type PurchaseCalculationItem = {
  quantity: Prisma.Decimal | number | string;
  unitPrice: Prisma.Decimal | number | string;
  taxProfile?: PurchaseTaxProfileId | null;
  customTaxes?: PurchaseTaxComponentInput[];
};

export type PurchaseCalculationInput = {
  items: PurchaseCalculationItem[];
  discountType: PurchaseDiscountType;
  discountValue: Prisma.Decimal | number | string;
};

export type CalculatedItemTax = {
  code: string;
  name: string;
  rate: Prisma.Decimal;
  taxableBase: Prisma.Decimal;
  amount: Prisma.Decimal;
  sortOrder: number;
};

export type CalculatedPurchaseItem = {
  lineSubtotal: Prisma.Decimal;
  itemDiscount: Prisma.Decimal;
  taxableBase: Prisma.Decimal;
  taxes: CalculatedItemTax[];
  taxAmount: Prisma.Decimal;
  itemTotal: Prisma.Decimal;
  taxProfile: PurchaseTaxProfileId;
  taxLabel: string;
};

export type TaxSummaryLine = {
  code: string;
  name: string;
  rate: Prisma.Decimal;
  taxableBase: Prisma.Decimal;
  amount: Prisma.Decimal;
};

const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);

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

export function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

export function formatItemTaxLabel(
  taxes: Array<{ code: string; name: string }>,
): string {
  if (taxes.length === 0) return 'Exento';
  const codes = new Set(taxes.map((tax) => tax.code));
  if (taxes.length === 2 && codes.has('ISV_15') && codes.has('TOURISM_4')) {
    return 'ISV 15% + TST 4%';
  }
  if (taxes.length === 1) return taxes[0].name;
  return taxes.map((tax) => tax.name).join(' + ');
}

function assertRate(rate: Prisma.Decimal) {
  if (rate.isNegative() || rate.greaterThan(MAX_TAX_RATE) || !rate.isFinite()) {
    throw new Error('INVALID_TAX_RATE');
  }
}

export function resolveTaxComponents(
  profile: PurchaseTaxProfileId,
  customTaxes: PurchaseTaxComponentInput[] = [],
): Array<{ code: string; name: string; rate: Prisma.Decimal }> {
  if (profile === 'CUSTOM') {
    if (customTaxes.length === 0) throw new Error('INVALID_CUSTOM_TAX');
    const codes = new Set<string>();
    return customTaxes.map((tax) => {
      const code = tax.code.trim().toUpperCase();
      const name = tax.name.trim();
      const rate = toDecimal(tax.rate);
      if (!/^[A-Z][A-Z0-9_]{0,31}$/.test(code) || name.length < 2) {
        throw new Error('INVALID_CUSTOM_TAX');
      }
      if (codes.has(code)) throw new Error('DUPLICATE_TAX_CODE');
      codes.add(code);
      assertRate(rate);
      return { code, name, rate };
    });
  }
  return PURCHASE_TAX_PROFILES[profile].map((tax) => ({
    code: tax.code,
    name: tax.name,
    rate: new Prisma.Decimal(tax.rate),
  }));
}

export function calculateItemTaxes(
  taxableBase: Prisma.Decimal,
  components: Array<{ code: string; name: string; rate: Prisma.Decimal }>,
): CalculatedItemTax[] {
  const base = Prisma.Decimal.max(taxableBase, ZERO).toDecimalPlaces(2);
  return components.map((component, index) => {
    assertRate(component.rate);
    const amount = base.mul(component.rate).div(HUNDRED).toDecimalPlaces(2);
    if (amount.isNegative()) throw new Error('INVALID_TAX_AMOUNT');
    return {
      code: component.code,
      name: component.name,
      rate: component.rate,
      taxableBase: base,
      amount,
      sortOrder: index,
    };
  });
}

function sumDecimals(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((sum, value) => sum.add(value), ZERO).toDecimalPlaces(2);
}

function allocateOrderDiscount(lineSubtotals: Prisma.Decimal[], discount: Prisma.Decimal): Prisma.Decimal[] {
  if (discount.lessThanOrEqualTo(0) || lineSubtotals.length === 0) {
    return lineSubtotals.map(() => ZERO);
  }
  const subtotal = sumDecimals(lineSubtotals);
  if (subtotal.lessThanOrEqualTo(0)) return lineSubtotals.map(() => ZERO);

  const allocated = lineSubtotals.map((line) => discount.mul(line).div(subtotal).toDecimalPlaces(2));
  const remainder = discount.toDecimalPlaces(2).sub(sumDecimals(allocated));
  if (!remainder.isZero()) {
    let target = 0;
    for (let index = 1; index < lineSubtotals.length; index += 1) {
      if (lineSubtotals[index].greaterThan(lineSubtotals[target])) target = index;
    }
    allocated[target] = allocated[target].add(remainder);
  }
  return allocated;
}

export function calculatePurchaseOrderItem(input: {
  quantity: Prisma.Decimal | number | string;
  unitPrice: Prisma.Decimal | number | string;
  itemDiscount?: Prisma.Decimal | number | string;
  taxProfile: PurchaseTaxProfileId;
  customTaxes?: PurchaseTaxComponentInput[];
}): CalculatedPurchaseItem {
  const quantity = toDecimal(input.quantity);
  const unitPrice = toDecimal(input.unitPrice);
  if (quantity.isNegative() || !quantity.isFinite()) throw new Error('INVALID_QUANTITY');
  if (unitPrice.isNegative() || !unitPrice.isFinite()) throw new Error('INVALID_UNIT_PRICE');

  const lineSubtotal = quantity.mul(unitPrice).toDecimalPlaces(2);
  const requestedDiscount = toDecimal(input.itemDiscount ?? 0);
  const itemDiscount = Prisma.Decimal.min(
    Prisma.Decimal.max(requestedDiscount, ZERO),
    lineSubtotal,
  ).toDecimalPlaces(2);
  const taxableBase = lineSubtotal.sub(itemDiscount).toDecimalPlaces(2);
  const taxes = calculateItemTaxes(
    taxableBase,
    resolveTaxComponents(input.taxProfile, input.customTaxes),
  );
  const taxAmount = sumDecimals(taxes.map((tax) => tax.amount));
  return {
    lineSubtotal,
    itemDiscount,
    taxableBase,
    taxes,
    taxAmount,
    itemTotal: taxableBase.add(taxAmount).toDecimalPlaces(2),
    taxProfile: input.taxProfile,
    taxLabel: formatItemTaxLabel(taxes),
  };
}

export function aggregateTaxSummary(items: CalculatedPurchaseItem[]): {
  taxSummary: TaxSummaryLine[];
  exemptBase: Prisma.Decimal;
} {
  const groups = new Map<string, TaxSummaryLine>();
  let exemptBase = ZERO;

  for (const item of items) {
    if (item.taxes.length === 0) {
      exemptBase = exemptBase.add(item.taxableBase);
      continue;
    }
    for (const tax of item.taxes) {
      const key = `${tax.code}:${tax.rate.toFixed(4)}`;
      const current = groups.get(key);
      if (current) {
        current.taxableBase = current.taxableBase.add(tax.taxableBase).toDecimalPlaces(2);
        current.amount = current.amount.add(tax.amount).toDecimalPlaces(2);
      } else {
        groups.set(key, {
          code: tax.code,
          name: tax.name,
          rate: tax.rate,
          taxableBase: tax.taxableBase,
          amount: tax.amount,
        });
      }
    }
  }

  return {
    taxSummary: [...groups.values()],
    exemptBase: exemptBase.toDecimalPlaces(2),
  };
}

export function calculatePurchaseOrder(input: PurchaseCalculationInput) {
  const discountType = input.discountType;
  const discountValue = toDecimal(input.discountValue);
  if (discountValue.isNegative()) throw new Error('INVALID_DISCOUNT_VALUE');
  if (discountType === 'PORCENTAJE' && discountValue.greaterThan(100)) {
    throw new Error('INVALID_DISCOUNT_PERCENTAGE');
  }

  const lineSubtotals = input.items.map((item) => {
    const quantity = toDecimal(item.quantity);
    const unitPrice = toDecimal(item.unitPrice);
    if (!quantity.isFinite() || quantity.isNegative()) throw new Error('INVALID_QUANTITY');
    if (!unitPrice.isFinite() || unitPrice.isNegative()) throw new Error('INVALID_UNIT_PRICE');
    return quantity.mul(unitPrice).toDecimalPlaces(2);
  });

  const subtotal = sumDecimals(lineSubtotals);
  let requestedDiscount = ZERO;
  if (discountType === 'MONTO') requestedDiscount = discountValue;
  if (discountType === 'PORCENTAJE') requestedDiscount = subtotal.mul(discountValue).div(HUNDRED);
  const discount = Prisma.Decimal.min(Prisma.Decimal.max(requestedDiscount, ZERO), subtotal).toDecimalPlaces(2);

  const allocated = allocateOrderDiscount(lineSubtotals, discount);
  const items = input.items.map((item, index) => {
    if (!item.taxProfile) throw new Error('ITEM_TAX_PROFILE_REQUIRED');
    return calculatePurchaseOrderItem({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      itemDiscount: allocated[index],
      taxProfile: item.taxProfile,
      customTaxes: item.customTaxes,
    });
  });

  const { taxSummary, exemptBase } = aggregateTaxSummary(items);
  const tax = sumDecimals(items.map((item) => item.taxAmount));
  const taxableBase = sumDecimals(items.map((item) => item.taxableBase));
  const total = subtotal.sub(discount).add(tax).toDecimalPlaces(2);

  return {
    lineTotals: items.map((item) => item.lineSubtotal),
    items,
    subtotal,
    discount,
    taxableBase,
    tax,
    total,
    taxSummary,
    exemptBase,
  };
}
