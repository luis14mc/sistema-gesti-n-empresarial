/** Inclusive civil-day bounds for `@db.Date` columns. */
export function civilDateInclusiveFilter(from: string, to: string) {
  return {
    gte: new Date(`${from}T00:00:00.000Z`),
    lte: new Date(`${to}T00:00:00.000Z`),
  };
}

function shiftCivilDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Half-open civil-day bounds for `DateTime` columns. */
export function civilDateTimeRangeFilter(from: string, to: string) {
  return {
    gte: new Date(`${from}T00:00:00.000Z`),
    lt: new Date(`${shiftCivilDate(to, 1)}T00:00:00.000Z`),
  };
}
