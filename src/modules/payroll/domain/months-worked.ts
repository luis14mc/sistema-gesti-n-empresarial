import { utcCalendarParts } from './date-parts';

/**
 * Months remaining in the fiscal year from the hire month through December (inclusive).
 * Returns 12 when the employee was hired before the given year.
 * Returns 0 when hired after the pay year, or when hire month is after the pay month in the same year.
 */
export function monthsWorkedInYear(hireDate: Date, year: number, payMonth?: number): number {
  const { year: hireYear, month: hireMonth } = utcCalendarParts(hireDate);
  if (hireYear > year) {
    return 0;
  }
  if (hireYear < year) {
    return 12;
  }
  if (payMonth !== undefined && hireMonth > payMonth) {
    return 0;
  }
  return 12 - hireMonth + 1;
}
