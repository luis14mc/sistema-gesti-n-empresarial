import { DEFAULT_PAYROLL_SETTINGS } from './constants';
import { moneyNumber, toDecimal } from './decimal';
import { EmployeeNotYetHiredError } from './errors';
import { calculateIhss } from './ihss';
import { calculateIsr } from './isr';
import { isPrimerMesForPayMonth } from './pay-month';
import { monthsWorkedInYear } from './months-worked';
import { periodFromPayMonth } from './period';
import { payMonthLastDay, proratedSalary, shouldProrateSalary } from './proration';
import type { PayslipInput, PayslipResult, PayrollSettings } from './types';

function resolveSettings(settings?: PayrollSettings): PayrollSettings {
  if (!settings) {
    return {
      ihss: { ...DEFAULT_PAYROLL_SETTINGS.ihss },
      isr: {
        ...DEFAULT_PAYROLL_SETTINGS.isr,
        brackets: DEFAULT_PAYROLL_SETTINGS.isr.brackets.map((b) => ({ ...b })),
      },
    };
  }
  return settings;
}

function periodSalary(
  monthlySalary: number,
  hireDate: Date,
  payPeriod: { year: number; month: number; end: Date },
): number {
  if (shouldProrateSalary(hireDate, payPeriod.year, payPeriod.month)) {
    return proratedSalary(monthlySalary, hireDate, payMonthLastDay(payPeriod.end));
  }
  return moneyNumber(monthlySalary);
}

export function calculatePayslip(input: PayslipInput): PayslipResult {
  const settings = resolveSettings(input.settings);
  const payPeriod = periodFromPayMonth(input.payMonth);
  const monthsInYear = monthsWorkedInYear(input.hireDate, payPeriod.year, payPeriod.month);

  if (monthsInYear === 0) {
    throw new EmployeeNotYetHiredError();
  }

  const salarioPeriodo = periodSalary(input.monthlySalary, input.hireDate, payPeriod);

  const isPrimerMes = isPrimerMesForPayMonth(input.hireDate, payPeriod.year, payPeriod.month);

  const ihss = calculateIhss(salarioPeriodo, settings.ihss);
  const isr = calculateIsr({
    monthlySalary: input.monthlySalary,
    salarioPeriodo,
    isPrimerMes,
    monthsInYear,
    settings: settings.isr,
  });

  const otherDeductions = moneyNumber(input.otherDeductions ?? 0);
  const netPay = moneyNumber(
    toDecimal(salarioPeriodo).minus(ihss).minus(isr).minus(otherDeductions),
  );

  return {
    payPeriod,
    salarioPeriodo,
    ihss,
    isr,
    otherDeductions,
    netPay,
    monthsWorkedInYear: monthsInYear,
    isPrimerMes,
  };
}
