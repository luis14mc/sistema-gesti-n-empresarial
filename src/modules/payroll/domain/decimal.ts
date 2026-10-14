import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

/** Round to 2 decimal places (ROUND_HALF_UP). */
export function money(value: Decimal.Value): Decimal {
  return toDecimal(value).toDecimalPlaces(2);
}

export function moneyNumber(value: Decimal.Value): number {
  return money(value).toNumber();
}
