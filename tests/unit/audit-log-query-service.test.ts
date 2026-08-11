// Phase 10B — domain unit tests for the audit log query service.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  auditRecord: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { auditLogQueryService } from '@/platform/security/audit/audit-log-query-service';

const ADMIN_CONTEXT = {
  authorizationScope: 'organization' as const,
  organizationId: 'org-a',
  organizationSlug: 'org-a',
  timezone: 'America/Tegucigalpa',
  membershipId: 'mem-1',
  userId: 'admin-1',
  role: 'ADMIN' as const,
};

beforeEach(() => {
  prismaMock.auditRecord.findMany.mockReset();
  prismaMock.auditRecord.count.mockReset();
});

describe('auditLogQueryService.list — shape', () => {
  it('scopes the query by the active organizationId', async () => {
    prismaMock.auditRecord.findMany.mockResolvedValueOnce([]);
    prismaMock.auditRecord.count.mockResolvedValueOnce(0);

    await auditLogQueryService.list(ADMIN_CONTEXT, { page: 1, pageSize: 20 });

    expect(prismaMock.auditRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-a' }),
      }),
    );
  });

  it('defaults a missing page to 1 and clamps a malformed pageSize to 20', async () => {
    prismaMock.auditRecord.findMany.mockResolvedValueOnce([]);
    prismaMock.auditRecord.count.mockResolvedValueOnce(0);

    await auditLogQueryService.list(ADMIN_CONTEXT, {
      page: -1 as unknown as number,
      pageSize: Number.POSITIVE_INFINITY as unknown as number,
    });

    expect(prismaMock.auditRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('clamps pageSize to 100 maximum', async () => {
    prismaMock.auditRecord.findMany.mockResolvedValueOnce([]);
    prismaMock.auditRecord.count.mockResolvedValueOnce(0);

    await auditLogQueryService.list(ADMIN_CONTEXT, { page: 1, pageSize: 1_000 });

    expect(prismaMock.auditRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('applies the userId, module, and action filters when provided', async () => {
    prismaMock.auditRecord.findMany.mockResolvedValueOnce([]);
    prismaMock.auditRecord.count.mockResolvedValueOnce(0);

    await auditLogQueryService.list(ADMIN_CONTEXT, {
      page: 1,
      pageSize: 20,
      userId: 'user-1',
      module: 'equipment',
      action: 'UPDATE',
    });

    expect(prismaMock.auditRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-a',
          userId: 'user-1',
          module: 'equipment',
          category: 'UPDATE',
        }),
      }),
    );
  });
});
