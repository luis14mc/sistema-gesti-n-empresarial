import { moneyNumber, toDecimal } from './decimal';
import { utcCalendarParts, isSameUtcCalendarMonth } from './date-parts';
import { lastDayOfMonth } from './period';

const DAYS_IN_SALARY_MONTH = 30;

/**
 * Prorates monthly salary when the employee is hired mid-period.
 * Uses calendar days from hire date through the last day of the pay month, over a 30-day month.
 * Hire dates from @db.Date use UTC calendar parts so the day is not shifted by local TZ.
 */
export function proratedSalary(
  monthlySalary: number,
  hireDate: Date,
  periodEnd: Date,
): number {
  const hire = utcCalendarParts(hireDate);
  const end = utcCalendarParts(periodEnd);

  const year = end.year;
  const month = end.month;
  const lastDay = lastDayOfMonth(year, month);

  if (hire.year > year || (hire.year === year && hire.month > month)) {
    return 0;
  }

  if (hire.year < year || hire.month < month) {
    return moneyNumber(monthlySalary);
  }

  const hireDay = hire.day;
  const daysWorked = lastDay - hireDay + 1;
  if (daysWorked <= 0) {
    return 0;
  }

  const amount = toDecimal(monthlySalary).mul(daysWorked).div(DAYS_IN_SALARY_MONTH);
  return moneyNumber(amount);
}

export function isSameCalendarMonth(a: Date, b: Date): boolean {
  return isSameUtcCalendarMonth(a, b);
}

export function shouldProrateSalary(hireDate: Date, periodStart: Date, periodEnd: Date): boolean {
  const hire = utcCalendarParts(hireDate);
  const start = utcCalendarParts(periodStart);
  const end = utcCalendarParts(periodEnd);
  const hireAfterStart =
    hire.year > start.year
    || (hire.year === start.year && hire.month > start.month)
    || (hire.year === start.year && hire.month === start.month && hire.day > start.day);
  return hireAfterStart && isSameUtcCalendarMonth(hireDate, periodEnd);
}

/** Last calendar day of the pay month containing `periodEnd`. */
export function payMonthLastDay(periodEnd: Date): Date {
  const { year, month } = utcCalendarParts(periodEnd);
  const day = lastDayOfMonth(year, month);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}
