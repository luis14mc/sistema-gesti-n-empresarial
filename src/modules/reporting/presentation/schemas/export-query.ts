import { z } from 'zod';
import { isValidReportDate } from '@/modules/reporting/domain/filter-validation';
import { configuredReportMaxRangeDays } from '@/modules/reporting/domain/filter-validation';

const dateSchema = z.string().refine(isValidReportDate, 'INVALID_DATE');

export const reportExportQuerySchema = z.object({
  format: z.enum(['csv', 'xlsx']).default('csv'),
  from: dateSchema,
  to: dateSchema,
  status: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.from > value.to) {
    ctx.addIssue({ code: 'custom', message: 'INVALID_DATE_RANGE', path: ['from'] });
    return;
  }
  const maxDays = configuredReportMaxRangeDays();
  const days = Math.floor(
    (Date.parse(`${value.to}T00:00:00.000Z`) - Date.parse(`${value.from}T00:00:00.000Z`)) / 86_400_000,
  ) + 1;
  if (days > maxDays) {
    ctx.addIssue({ code: 'custom', message: 'DATE_RANGE_TOO_LONG', path: ['to'] });
  }
});

export type ParsedReportExportQuery = z.infer<typeof reportExportQuerySchema>;

export function parseReportExportSearchParams(searchParams: URLSearchParams): ParsedReportExportQuery {
  return reportExportQuerySchema.parse({
    format: (searchParams.get('format') ?? 'csv').toLowerCase(),
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    type: searchParams.get('type') ?? undefined,
  });
}
