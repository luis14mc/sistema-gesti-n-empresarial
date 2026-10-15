import { utcCalendarParts } from './date-parts';

/** Matches server.py `_es_primer_mes_empleado`: pay month equals hire month in the same year. */
export function isPrimerMesForPayMonth(
  hireDate: Date,
  payYear: number,
  payMonth: number,
): boolean {
  const hire = utcCalendarParts(hireDate);
  return hire.year === payYear && hire.month === payMonth;
}
