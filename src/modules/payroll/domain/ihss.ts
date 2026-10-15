import { moneyNumber, toDecimal } from './decimal';
import { normalizeIhssRate } from './rate-normalize';
import type { IhssSettings } from './types';

/** IHSS: min(salarioPeriodo, techo) × (tasaEM + tasaIVM) / 100 (tasas como en server.py: 2.5 = 2.5%). */
export function calculateIhss(salarioPeriodo: number, settings: IhssSettings): number {
  const base = Math.min(salarioPeriodo, settings.ceilingMonthly);
  const emRate = normalizeIhssRate(settings.emRate);
  const ivmRate = normalizeIhssRate(settings.ivmRate);
  const rate = emRate + ivmRate;
  return moneyNumber(toDecimal(base).mul(rate).div(100));
}
