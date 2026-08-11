import type { OrganizationContext } from '@/modules/organizations/application/context';
import { ReportNotFoundError } from '../../domain/errors';
import { assertReportDateRange, assertReportPagination, assertSafeReportFilters } from '../../domain/filter-validation';
import type { ReportCode, ReportDateRange, ReportFilters, ReportPagination, ReportResult } from '../../domain/report-types';
import { requirePermission } from '@/platform/security/authorization/permissions';
import { getReportDefinition } from '../services/report-catalog';

export type ReportReadContext = Readonly<{
  organizationId: string;
  userId: string;
  timezone: string;
}>;

export type ReportQuery = Readonly<{
  dateRange: ReportDateRange;
  filters: ReportFilters;
  pagination?: ReportPagination;
}>;

export interface ReportQueryHandler<TResult = unknown> {
  execute(context: ReportReadContext, query: ReportQuery): Promise<ReportResult<TResult>>;
}

export class ReportingQueryService {
  constructor(private readonly handlers: Partial<Record<ReportCode, ReportQueryHandler>>) {}

  async execute<TResult>(
    context: OrganizationContext,
    code: ReportCode,
    query: ReportQuery,
  ): Promise<ReportResult<TResult>> {
    const definition = getReportDefinition(code);
    requirePermission(context, definition.requiredPermission);

    const handler = this.handlers[code];
    if (!handler) throw new ReportNotFoundError(code);
    const dateRange = assertReportDateRange(query.dateRange, context.timezone);
    assertReportPagination(query.pagination);
    assertSafeReportFilters(query.filters);

    return handler.execute({
      organizationId: context.organizationId,
      userId: context.userId,
      timezone: context.timezone,
    }, {
      ...query,
      dateRange,
    }) as Promise<ReportResult<TResult>>;
  }
}
