import { DEFAULT_PAYROLL_SETTINGS } from './constants';
import { moneyNumber, toDecimal } from './decimal';
import { EmployeeNotYetHiredError } from './errors';
import { calculateIhss } from './ihss';
import { calculateIsr, isPrimerMesForIsr } from './isr';
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
  periodStart: Date,
  periodEnd: Date,
): number {
  if (shouldProrateSalary(hireDate, periodStart, periodEnd)) {
    return proratedSalary(monthlySalary, hireDate, payMonthLastDay(periodEnd));
  }
  return moneyNumber(monthlySalary);
}

export function calculatePayslip(input: PayslipInput): PayslipResult {
  const settings = resolveSettings(input.settings);
  const payPeriod = periodFromPayMonth(input.payMonth);
  const monthsInYear = monthsWorkedInYear(input.hireDate, payPeriod.year);

  if (monthsInYear === 0) {
    throw new EmployeeNotYetHiredError();
  }

  const salarioPeriodo = periodSalary(
    input.monthlySalary,
    input.hireDate,
    payPeriod.start,
    payPeriod.end,
  );

  const ihss = calculateIhss(salarioPeriodo, settings.ihss);
  const isPrimerMes = isPrimerMesForIsr(input.hireDate, payPeriod.end);
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
