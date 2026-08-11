import type { OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { OrganizationContext } from '@/modules/organizations/application/context';
import { PermissionDeniedError } from '@/platform/domain/errors';
import type { ReportResult } from '@/modules/reporting/domain/report-types';
import { can, organizationRole } from '@/platform/security/authorization/permissions';
import { listAvailableReports, REPORT_CATALOG } from '@/modules/reporting/application/services/report-catalog';
import { ReportingQueryService, type ReportQuery, type ReportQueryHandler, type ReportReadContext } from '@/modules/reporting/application/queries/reporting-query-service';
import { ReportExecutionService, type ReportExecutionRepository } from '@/modules/reporting/application/services/report-execution-service';
import { parseReportQuery } from '@/modules/reporting/presentation/schemas/report-filters';

function context(organizationId: string, role: OrganizationRole = 'ADMIN'): OrganizationContext {
  return {
    authorizationScope: 'organization',
    organizationId,
    organizationSlug: organizationId,
    timezone: 'America/Tegucigalpa',
    membershipId: `membership-${organizationId}`,
    userId: `user-${organizationId}`,
    role,
  };
}

describe('Phase 4A reporting foundation', () => {
  it('keeps one centralized definition per report code', () => {
    expect(new Set(REPORT_CATALOG.map((report) => report.code)).size).toBe(REPORT_CATALOG.length);
    expect(REPORT_CATALOG.every((report) => report.filters.some((filter) => filter.type === 'date-range'))).toBe(true);
  });

  it('does not grant platform reports through any organization role', () => {
    const roles: OrganizationRole[] = ['OWNER', 'ADMIN', 'IT_MANAGER', 'IT_TECHNICIAN', 'PROCUREMENT', 'HR', 'AUDITOR', 'USER'];
    expect(roles.every((role) => !can(organizationRole(role), 'reports.platform'))).toBe(true);
    expect(listAvailableReports('USER')).toEqual([]);
    expect(listAvailableReports('PROCUREMENT').some((report) => report.code === 'PURCHASE_ORDER_TAX_ANALYSIS')).toBe(true);
    expect(listAvailableReports('PROCUREMENT').some((report) => report.code === 'EQUIPMENT_MAINTENANCE_COST')).toBe(false);
    expect(listAvailableReports('HR').some((report) => report.code === 'SYSTEM_AUDIT_EVENTS')).toBe(false);
  });

  it('parses shareable date filters in the organization timezone', () => {
    const custom = parseReportQuery(new URLSearchParams('from=2026-01-01&to=2026-07-31&page=2&pageSize=50'), 'America/Tegucigalpa');
    expect(custom).toEqual({
      period: 'CUSTOM',
      dateRange: { from: '2026-01-01', to: '2026-07-31', timezone: 'America/Tegucigalpa' },
      pagination: { page: 2, pageSize: 50 },
    });

    const today = parseReportQuery(new URLSearchParams('period=TODAY'), 'America/Tegucigalpa', {
      now: new Date('2026-07-23T03:00:00.000Z'),
    });
    expect(today.dateRange).toMatchObject({ from: '2026-07-22', to: '2026-07-22' });
  });

  it('rejects invalid, reversed, and unbounded ranges', () => {
    expect(() => parseReportQuery(new URLSearchParams('from=2026-02-30&to=2026-03-01'), 'America/Tegucigalpa')).toThrow('Los filtros del reporte no son válidos.');
    expect(() => parseReportQuery(new URLSearchParams('from=2026-03-02&to=2026-03-01'), 'America/Tegucigalpa')).toThrow('Los filtros del reporte no son válidos.');
    expect(() => parseReportQuery(new URLSearchParams('from=2026-01-01&to=2026-02-01'), 'America/Tegucigalpa', { maxRangeDays: 30 })).toThrow('Los filtros del reporte no son válidos.');
    expect(() => parseReportQuery(new URLSearchParams('period=TODAY'), 'CST')).toThrow('Los filtros del reporte no son válidos.');
  });

  it('passes only trusted tenant context to report handlers', async () => {
    const execute = vi.fn(async (readContext: ReportReadContext, _query: ReportQuery): Promise<ReportResult<{ total: number }>> => ({
      data: { total: readContext.organizationId === 'org-a' ? 3 : 7 },
      meta: { reportCode: 'EQUIPMENT_INVENTORY', from: '2026-07-01', to: '2026-07-31', timezone: readContext.timezone },
    }));
    const service = new ReportingQueryService({ EQUIPMENT_INVENTORY: { execute } as ReportQueryHandler });
    const query = {
      dateRange: { from: '2026-07-01', to: '2026-07-31', timezone: 'client-controlled-zone' },
      filters: {},
    };

    await service.execute(context('org-a'), 'EQUIPMENT_INVENTORY', query);
    await service.execute(context('org-b'), 'EQUIPMENT_INVENTORY', query);

    expect(execute.mock.calls[0][0]).toEqual({ organizationId: 'org-a', userId: 'user-org-a', timezone: 'America/Tegucigalpa' });
    expect(execute.mock.calls[0][1].dateRange.timezone).toBe('America/Tegucigalpa');
    expect(execute.mock.calls[1][0].organizationId).toBe('org-b');
  });

  it('rejects tenant-shaped filter keys before invoking a handler', async () => {
    const execute = vi.fn();
    const service = new ReportingQueryService({ EQUIPMENT_INVENTORY: { execute } });
    await expect(service.execute(context('org-a'), 'EQUIPMENT_INVENTORY', {
      dateRange: { from: '2026-07-01', to: '2026-07-31', timezone: 'America/Tegucigalpa' },
      filters: { organizationId: 'org-b' },
    })).rejects.toThrow('Los filtros del reporte no son válidos.');
    expect(execute).not.toHaveBeenCalled();
  });

  it('checks report permissions before invoking a query handler', async () => {
    const execute = vi.fn();
    const service = new ReportingQueryService({ PURCHASE_ORDER_SUMMARY: { execute } });
    await expect(service.execute(context('org-a', 'HR'), 'PURCHASE_ORDER_SUMMARY', {
      dateRange: { from: '2026-07-01', to: '2026-07-31', timezone: 'America/Tegucigalpa' },
      filters: {},
    })).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(execute).not.toHaveBeenCalled();
  });

  it('creates execution records from canonical tenant and user context', async () => {
    const create = vi.fn(async (input) => ({
      id: 'execution-1',
      ...input,
      status: 'PENDING' as const,
      rowCount: null,
      storageKey: null,
      durationMs: null,
      createdAt: new Date('2026-07-23T00:00:00.000Z'),
      completedAt: null,
    }));
    const service = new ReportExecutionService({ create } as ReportExecutionRepository);
    await service.create(context('org-a', 'PROCUREMENT'), {
      reportCode: 'PURCHASE_ORDER_SUMMARY',
      format: 'XLSX',
      dateRange: { from: '2026-07-01', to: '2026-07-31', timezone: 'untrusted' },
      requestId: 'request-1',
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-a',
      userId: 'user-org-a',
      filters: { from: '2026-07-01', to: '2026-07-31', timezone: 'America/Tegucigalpa' },
    }));
  });

  it('validates execution ranges and reserved filters at the application boundary', async () => {
    const create = vi.fn();
    const service = new ReportExecutionService({ create } as unknown as ReportExecutionRepository);
    await expect(service.create(context('org-a', 'PROCUREMENT'), {
      reportCode: 'PURCHASE_ORDER_SUMMARY',
      format: 'CSV',
      dateRange: { from: '2026-08-01', to: '2026-07-01', timezone: 'UTC' },
      requestId: 'request-2',
    })).rejects.toThrow('Los filtros del reporte no son válidos.');
    await expect(service.create(context('org-a', 'PROCUREMENT'), {
      reportCode: 'PURCHASE_ORDER_SUMMARY',
      format: 'CSV',
      dateRange: { from: '2026-07-01', to: '2026-07-31', timezone: 'UTC' },
      filters: { userId: 'user-other' },
      requestId: 'request-3',
    })).rejects.toThrow('Los filtros del reporte no son válidos.');
    expect(create).not.toHaveBeenCalled();
  });
});
