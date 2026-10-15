import { utcCalendarParts } from './date-parts';
import { Decimal, moneyNumber, toDecimal } from './decimal';
import type { IsrSettings } from './types';

export interface CalculateIsrInput {
  monthlySalary: number;
  salarioPeriodo: number;
  isPrimerMes: boolean;
  monthsInYear: number;
  settings: IsrSettings;
}

function progressiveAnnualTax(rentaNeta: Decimal, settings: IsrSettings): Decimal {
  const renta = toDecimal(rentaNeta);
  let tax = toDecimal(0);

  for (let i = 0; i < settings.brackets.length; i += 1) {
    const bracket = settings.brackets[i];
    const rate = bracket.rate;
    if (rate === 0) {
      continue;
    }
    const previousTo = i === 0 ? 0 : settings.brackets[i - 1].to;
    if (renta.lte(previousTo)) {
      break;
    }
    const upper = Decimal.min(renta, toDecimal(bracket.to));
    const taxable = upper.minus(previousTo);
    if (taxable.gt(0)) {
      tax = tax.plus(taxable.mul(rate).div(100));
    }
  }

  return tax;
}

function projectedAnnualSalary(input: CalculateIsrInput): Decimal {
  const { monthlySalary, salarioPeriodo, isPrimerMes, monthsInYear } = input;
  const salary = toDecimal(monthlySalary);

  if (isPrimerMes) {
    return toDecimal(salarioPeriodo).plus(salary.mul(Math.max(monthsInYear - 1, 0)));
  }

  return salary.mul(monthsInYear);
}

export function calculateIsr(input: CalculateIsrInput): number {
  const { monthsInYear, settings } = input;
  if (monthsInYear <= 0) {
    return 0;
  }

  const projected = projectedAnnualSalary(input);
  const medical = toDecimal(settings.medicalExpensesAnnual).mul(monthsInYear).div(12);
  const ivm = toDecimal(settings.ivmDeductibleMonthly).mul(monthsInYear);
  const deductions = medical.plus(ivm);

  const rentaNeta = Decimal.max(projected.minus(deductions), 0);
  const annualTax = progressiveAnnualTax(rentaNeta, settings);
  const monthlyIsr = annualTax.div(monthsInYear);

  return moneyNumber(monthlyIsr);
}

export function isPrimerMesForIsr(hireDate: Date, periodEnd: Date): boolean {
  const hire = utcCalendarParts(hireDate);
  const end = utcCalendarParts(periodEnd);
  return hire.year === end.year && hire.month === end.month;
}
