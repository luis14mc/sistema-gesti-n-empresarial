import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { OrganizationRole } from '@prisma/client';
import type { AuthenticatedRequest } from '@/platform/api/with-auth';

const executionCreate = vi.fn(async (input: unknown) => ({
  id: 'exec-1',
  ...(input as object),
  status: 'PENDING',
  rowCount: null,
  durationMs: null,
  storageKey: null,
  createdAt: new Date(),
  completedAt: null,
}));
const executionComplete = vi.fn(async (_input: unknown) => undefined);

vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(async () => ({ name: 'CNI' })),
    },
    userPermissionOverride: {
      findMany: vi.fn(async () => []),
    },
    rolePermission: {
      findMany: vi.fn(async () => []),
    },
  },
}));

vi.mock('@/platform/api/with-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/modules/organizations/application/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/organizations/application/context')>();
  return {
    ...actual,
    requireOrganizationContext: vi.fn(async (req: AuthenticatedRequest) => ({
      authorizationScope: 'organization' as const,
      userId: req.user!.userId,
      organizationId: 'org-1',
      organizationSlug: 'cni',
      timezone: 'America/Tegucigalpa',
      membershipId: 'mem-1',
      role: req.user!.role as OrganizationRole,
    })),
  };
});

vi.mock('@/lib/reportes/registry', () => ({
  isExportableReportCode: (code: string) => code === 'PURCHASE_ORDER_SUMMARY',
  REPORT_DATASET_BUILDERS: {
    PURCHASE_ORDER_SUMMARY: vi.fn(async () => ({
      reportTitle: 'Resumen de órdenes de compra',
      baseFilename: 'ordenes-compra-test',
      generatedAt: new Date('2026-08-03T12:00:00Z'),
      columns: [{ key: 'orderNumber', header: 'N.º', type: 'text' as const }],
      rows: [{ orderNumber: 'OC-1' }],
    })),
  },
}));

vi.mock('@/modules/reporting/infrastructure/repositories/report-execution-repository', () => ({
  reportExecutionRepository: {
    create: (input: unknown) => executionCreate(input),
    complete: (input: unknown) => executionComplete(input),
  },
}));

vi.mock('@/platform/security/audit/audit-record', () => ({
  createAuditRecord: vi.fn(),
}));

vi.mock('@/platform/security/audit/security-events', () => ({
  appendSecurityEvent: vi.fn(),
  recordSecurityEventBestEffort: vi.fn(),
}));

import { GET as exportReport } from '@/app/api/reports/[code]/export/route';
import { createAuditRecord } from '@/platform/security/audit/audit-record';

function request(role: OrganizationRole, code: string, query: string): AuthenticatedRequest {
  const req = new NextRequest(
    new URL(`http://localhost/api/reports/${code}/export?${query}`),
    { method: 'GET' },
  ) as AuthenticatedRequest;
  req.user = { userId: 'user-1', email: 'user@cni.hn', role };
  return req;
}

beforeEach(() => {
  executionCreate.mockClear();
  executionComplete.mockClear();
  vi.mocked(createAuditRecord).mockClear();
});

describe('GET /api/reports/[code]/export', () => {
  it('returns 401 without authenticated user', async () => {
    const req = new NextRequest(
      new URL('http://localhost/api/reports/purchase_order_summary/export?format=csv&from=2026-01-01&to=2026-01-31'),
    ) as AuthenticatedRequest;
    const res = await exportReport(req, { params: Promise.resolve({ code: 'PURCHASE_ORDER_SUMMARY' }) });
    expect(res.status).toBe(401);
  });

  it('returns 403 when role lacks report permission', async () => {
    const res = await exportReport(
      request('USER', 'PURCHASE_ORDER_SUMMARY', 'format=csv&from=2026-01-01&to=2026-01-31'),
      { params: Promise.resolve({ code: 'PURCHASE_ORDER_SUMMARY' }) },
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 for unsupported format', async () => {
    const res = await exportReport(
      request('PROCUREMENT', 'PURCHASE_ORDER_SUMMARY', 'format=pdf&from=2026-01-01&to=2026-01-31'),
      { params: Promise.resolve({ code: 'PURCHASE_ORDER_SUMMARY' }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_REPORT_EXPORT_PARAMS');
  });

  it('returns 400 for invalid date range', async () => {
    const res = await exportReport(
      request('PROCUREMENT', 'PURCHASE_ORDER_SUMMARY', 'format=csv&from=2026-02-01&to=2026-01-01'),
      { params: Promise.resolve({ code: 'PURCHASE_ORDER_SUMMARY' }) },
    );
    expect(res.status).toBe(400);
  });

  it('exports CSV successfully and records execution + audit', async () => {
    const res = await exportReport(
      request('PROCUREMENT', 'PURCHASE_ORDER_SUMMARY', 'format=csv&from=2026-01-01&to=2026-01-31'),
      { params: Promise.resolve({ code: 'PURCHASE_ORDER_SUMMARY' }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(executionCreate).toHaveBeenCalled();
    expect(executionComplete).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
    expect(createAuditRecord).toHaveBeenCalled();
  });

  it('exports XLSX successfully', async () => {
    const res = await exportReport(
      request('PROCUREMENT', 'PURCHASE_ORDER_SUMMARY', 'format=xlsx&from=2026-01-01&to=2026-01-31'),
      { params: Promise.resolve({ code: 'PURCHASE_ORDER_SUMMARY' }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml');
  });
});
