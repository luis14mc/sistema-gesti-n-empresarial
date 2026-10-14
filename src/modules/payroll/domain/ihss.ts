import { moneyNumber, toDecimal } from './decimal';
import type { IhssSettings } from './types';

/** IHSS: min(salarioPeriodo, techo) × (tasaEM + tasaIVM) / 100 */
export function calculateIhss(salarioPeriodo: number, settings: IhssSettings): number {
  const base = Math.min(salarioPeriodo, settings.ceilingMonthly);
  const rate = settings.emRate + settings.ivmRate;
  return moneyNumber(toDecimal(base).mul(rate).div(100));
}
