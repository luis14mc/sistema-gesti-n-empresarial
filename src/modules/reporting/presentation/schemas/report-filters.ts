import { z } from 'zod';
import { InvalidReportFiltersError } from '../../domain/errors';
import { assertReportDateRange, configuredReportMaxRangeDays, isCanonicalIanaTimezone, isValidReportDate } from '../../domain/filter-validation';
import type { ReportDateRange, ReportPagination } from '../../domain/report-types';

export const REPORT_PERIODS = [
  'TODAY',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'CURRENT_MONTH',
  'CURRENT_QUARTER',
  'CURRENT_YEAR',
  'CUSTOM',
] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const reportDateSchema = z.string().refine(isValidReportDate, 'La fecha debe usar el formato AAAA-MM-DD.');
export const reportTimezoneSchema = z.string().min(1).refine(isCanonicalIanaTimezone, 'La zona horaria no es válida.');

const reportQueryInputSchema = z.object({
  period: z.enum(REPORT_PERIODS).optional(),
  from: reportDateSchema.optional(),
  to: reportDateSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
}).strict().superRefine((value, context) => {
  if ((value.from && !value.to) || (!value.from && value.to)) {
    context.addIssue({ code: 'custom', message: 'Debe indicar las fechas inicial y final.', path: ['from'] });
  }
  if (value.period === 'CUSTOM' && (!value.from || !value.to)) {
    context.addIssue({ code: 'custom', message: 'El período personalizado requiere ambas fechas.', path: ['from'] });
  }
});

export type ParsedReportQuery = Readonly<{
  period: ReportPeriod;
  dateRange: ReportDateRange;
  pagination: ReportPagination;
}>;

function dateInTimezone(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function presetRange(period: Exclude<ReportPeriod, 'CUSTOM'>, today: string): Pick<ReportDateRange, 'from' | 'to'> {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  if (period === 'TODAY') return { from: today, to: today };
  if (period === 'LAST_7_DAYS') return { from: shiftDate(today, -6), to: today };
  if (period === 'LAST_30_DAYS') return { from: shiftDate(today, -29), to: today };
  if (period === 'CURRENT_MONTH') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === 'CURRENT_QUARTER') {
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    return { from: `${year}-${String(quarterStartMonth).padStart(2, '0')}-01`, to: today };
  }
  return { from: `${year}-01-01`, to: today };
}

export function parseReportQuery(
  searchParams: URLSearchParams,
  timezone: string,
  options: { now?: Date; maxRangeDays?: number } = {},
): ParsedReportQuery {
  const parsedTimezone = reportTimezoneSchema.safeParse(timezone);
  const input = reportQueryInputSchema.safeParse({
    period: searchParams.get('period') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
  });

  if (!parsedTimezone.success || !input.success) {
    throw new InvalidReportFiltersError({
      timezone: parsedTimezone.success ? [] : parsedTimezone.error.issues,
      query: input.success ? [] : input.error.issues,
    });
  }

  const period: ReportPeriod = input.data.from && input.data.to
    ? 'CUSTOM'
    : input.data.period ?? 'LAST_30_DAYS';
  const range = period === 'CUSTOM'
    ? { from: input.data.from!, to: input.data.to! }
    : presetRange(period, dateInTimezone(options.now ?? new Date(), timezone));
  const maxRangeDays = options.maxRangeDays ?? configuredReportMaxRangeDays();

  const dateRange = assertReportDateRange(range, timezone, maxRangeDays);

  return {
    period,
    dateRange,
    pagination: { page: input.data.page, pageSize: input.data.pageSize },
  };
}
