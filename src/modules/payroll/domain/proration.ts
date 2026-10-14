import { Decimal, moneyNumber, toDecimal } from './decimal';
import { lastDayOfMonth } from './period';

const DAYS_IN_SALARY_MONTH = 30;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

/**
 * Prorates monthly salary when the employee is hired mid-period.
 * Uses calendar days from hire date through the last day of the pay month, over a 30-day month.
 */
export function proratedSalary(
  monthlySalary: number,
  hireDate: Date,
  periodEnd: Date,
): number {
  const hire = startOfLocalDay(hireDate);
  const end = startOfLocalDay(periodEnd);

  const year = end.getFullYear();
  const month = end.getMonth() + 1;
  const lastDay = lastDayOfMonth(year, month);

  if (hire.getFullYear() > year || (hire.getFullYear() === year && hire.getMonth() + 1 > month)) {
    return 0;
  }

  if (hire.getFullYear() < year || hire.getMonth() + 1 < month) {
    return moneyNumber(monthlySalary);
  }

  const hireDay = hire.getDate();
  const daysWorked = lastDay - hireDay + 1;
  if (daysWorked <= 0) {
    return 0;
  }

  const amount = toDecimal(monthlySalary).mul(daysWorked).div(DAYS_IN_SALARY_MONTH);
  return moneyNumber(amount);
}

export function isSameCalendarMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function shouldProrateSalary(hireDate: Date, periodStart: Date, periodEnd: Date): boolean {
  const hire = startOfLocalDay(hireDate);
  const start = startOfLocalDay(periodStart);
  const end = startOfLocalDay(periodEnd);
  return hire > start && isSameCalendarMonth(hire, end);
}

/** Last calendar day of the pay month containing `periodEnd`. */
export function payMonthLastDay(periodEnd: Date): Date {
  const year = periodEnd.getFullYear();
  const month = periodEnd.getMonth();
  const day = lastDayOfMonth(year, month + 1);
  return new Date(year, month, day, 12, 0, 0, 0);
}
