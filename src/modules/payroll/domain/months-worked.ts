/**
 * Months remaining in the fiscal year from the hire month through December (inclusive).
 * Returns 12 when the employee was hired before the given year.
 * Returns 0 when hired after the given year (caller should treat as not yet hired).
 */
export function monthsWorkedInYear(hireDate: Date, year: number): number {
  const hireYear = hireDate.getFullYear();
  if (hireYear > year) {
    return 0;
  }
  if (hireYear < year) {
    return 12;
  }
  const hireMonthIndex = hireDate.getMonth();
  return 12 - hireMonthIndex;
}
