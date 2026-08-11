import type { OrganizationContext } from '@/modules/organizations/application/context';
import { InvalidReportFiltersError } from '../../domain/errors';
import { assertReportDateRange, assertSafeReportFilters } from '../../domain/filter-validation';
import type { JsonValue, ReportCode, ReportDateRange, ReportFilters, ReportFormat } from '../../domain/report-types';
import { requirePermission } from '@/platform/security/authorization/permissions';
import { getReportDefinition } from './report-catalog';

export const REPORT_EXECUTION_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type ReportExecutionStatus = (typeof REPORT_EXECUTION_STATUSES)[number];

export type ReportExecutionRecord = Readonly<{
  id: string;
  organizationId: string;
  userId: string;
  reportCode: ReportCode;
  format: ReportFormat;
  filters: ReportFilters;
  status: ReportExecutionStatus;
  rowCount: number | null;
  storageKey: string | null;
  durationMs: number | null;
  requestId: string | null;
  createdAt: Date;
  completedAt: Date | null;
}>;

export interface ReportExecutionRepository {
  create(input: {
    organizationId: string;
    userId: string;
    reportCode: ReportCode;
    format: ReportFormat;
    filters: ReportFilters;
    requestId: string;
  }): Promise<ReportExecutionRecord>;
}

export class ReportExecutionService {
  constructor(private readonly repository: ReportExecutionRepository) {}

  async create(
    context: OrganizationContext,
    input: {
      reportCode: ReportCode;
      format: ReportFormat;
      dateRange: ReportDateRange;
      filters?: ReportFilters;
      requestId: string;
    },
  ): Promise<ReportExecutionRecord> {
    const definition = getReportDefinition(input.reportCode);
    requirePermission(context, definition.requiredPermission);
    requirePermission(context, 'reports.export');

    if (!definition.supportedFormats.includes(input.format)) {
      throw new InvalidReportFiltersError({ reportCode: input.reportCode, format: input.format });
    }
    const dateRange = assertReportDateRange(input.dateRange, context.timezone);
    assertSafeReportFilters(input.filters ?? {});

    const filters: ReportFilters = {
      ...(input.filters ?? {}),
      from: dateRange.from,
      to: dateRange.to,
      timezone: dateRange.timezone,
    } satisfies Readonly<Record<string, JsonValue>>;

    return this.repository.create({
      organizationId: context.organizationId,
      userId: context.userId,
      reportCode: input.reportCode,
      format: input.format,
      filters,
      requestId: input.requestId,
    });
  }
}
