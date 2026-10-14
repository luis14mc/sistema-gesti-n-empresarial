import type { PayPeriod } from './types';

const PAY_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function parsePayMonth(payMonth: string): { year: number; month: number } {
  const match = PAY_MONTH_PATTERN.exec(payMonth);
  if (!match) {
    throw new Error(`Invalid pay month "${payMonth}", expected YYYY-MM`);
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

function atLocalNoon(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Payroll period: day 20 of the previous calendar month through day 20 of the chosen month.
 */
export function periodFromPayMonth(payMonth: string): PayPeriod {
  const { year, month } = parsePayMonth(payMonth);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  return {
    start: atLocalNoon(prevYear, prevMonth, 20),
    end: atLocalNoon(year, month, 20),
    year,
    month,
  };
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
