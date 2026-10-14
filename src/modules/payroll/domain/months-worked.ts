import { utcCalendarParts } from './date-parts';

/**
 * Months remaining in the fiscal year from the hire month through December (inclusive).
 * Returns 12 when the employee was hired before the given year.
 * Returns 0 when hired after the given year (caller should treat as not yet hired).
 */
export function monthsWorkedInYear(hireDate: Date, year: number): number {
  const { year: hireYear, month: hireMonth } = utcCalendarParts(hireDate);
  if (hireYear > year) {
    return 0;
  }
  if (hireYear < year) {
    return 12;
  }
  return 12 - hireMonth + 1;
}
