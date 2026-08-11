import { InvalidReportFiltersError } from './errors';
import type { ReportDateRange, ReportFilters, ReportPagination } from './report-types';

const RESERVED_FILTER_KEYS = new Set([
  'organizationid',
  'organization',
  'tenantid',
  'userid',
  'timezone',
  'from',
  'to',
  'daterange',
]);

export function isValidReportDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

export function isCanonicalIanaTimezone(value: string): boolean {
  if (value !== 'UTC' && !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) return false;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone === value;
  } catch {
    return false;
  }
}

export function configuredReportMaxRangeDays(): number {
  const value = Number(process.env.REPORT_MAX_RANGE_DAYS ?? 366);
  return Number.isInteger(value) && value > 0 && value <= 3650 ? value : 366;
}

export function assertReportDateRange(
  range: Pick<ReportDateRange, 'from' | 'to'>,
  timezone: string,
  maxRangeDays = configuredReportMaxRangeDays(),
): ReportDateRange {
  if (!isCanonicalIanaTimezone(timezone) || !isValidReportDate(range.from) || !isValidReportDate(range.to)) {
    throw new InvalidReportFiltersError({ from: range.from, to: range.to, timezone });
  }
  const days = Math.floor((Date.parse(`${range.to}T00:00:00.000Z`) - Date.parse(`${range.from}T00:00:00.000Z`)) / 86_400_000) + 1;
  if (range.from > range.to || days > maxRangeDays) {
    throw new InvalidReportFiltersError({ from: range.from, to: range.to, maxRangeDays });
  }
  return { ...range, timezone };
}

export function assertReportPagination(pagination?: ReportPagination): void {
  if (pagination && (!Number.isInteger(pagination.page) || pagination.page < 1 || !Number.isInteger(pagination.pageSize) || pagination.pageSize < 1 || pagination.pageSize > 100)) {
    throw new InvalidReportFiltersError({ pagination });
  }
}

export function assertSafeReportFilters(filters: ReportFilters): void {
  const unsafeKeys = Object.keys(filters).filter((key) => RESERVED_FILTER_KEYS.has(key.toLowerCase()));
  if (unsafeKeys.length > 0) throw new InvalidReportFiltersError({ unsafeKeys });
}
