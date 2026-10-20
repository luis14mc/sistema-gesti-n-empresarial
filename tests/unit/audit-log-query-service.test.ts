// Phase 10B — domain unit tests for the audit log query service.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  auditRecord: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  userPermissionOverride: {
    findMany: vi.fn(),
  },
  rolePermission: {
    findMany: vi.fn(),
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

const AUDITOR_CONTEXT = {
  ...ADMIN_CONTEXT,
  userId: 'auditor-1',
  role: 'AUDITOR' as const,
};

beforeEach(() => {
  prismaMock.auditRecord.findMany.mockReset();
  prismaMock.auditRecord.count.mockReset();
  prismaMock.userPermissionOverride.findMany.mockReset();
  prismaMock.userPermissionOverride.findMany.mockResolvedValue([]);
  prismaMock.rolePermission.findMany.mockReset();
  prismaMock.rolePermission.findMany.mockResolvedValue([]);
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

describe('auditLogQueryService.list — email redaction', () => {
  const sampleLog = {
    id: 'log-1',
    title: 'Cambio',
    description: 'Contacto juan@cni.hn',
    module: 'users',
    category: 'UPDATE',
    priority: 'normal',
    status: 'done',
    entityId: 'e1',
    entityType: 'User',
    action: 'UPDATE',
    requestId: 'req-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    previousData: { email: 'juan@cni.hn' },
    newData: { email: 'juan.nuevo@cni.hn' },
    user: { id: 'u1', firstName: 'Juan', lastName: 'Pérez', email: 'juan@cni.hn' },
  };

  function mockRolePermissions(role: 'ADMIN' | 'AUDITOR', includeUsersRead: boolean) {
    const rows = [{ role, permission: 'audit.read' }];
    if (includeUsersRead) rows.push({ role, permission: 'users.read' });
    prismaMock.rolePermission.findMany.mockResolvedValue(rows);
  }

  it('masks emails for AUDITOR when users.read is not in the org role matrix', async () => {
    mockRolePermissions('AUDITOR', false);
    prismaMock.auditRecord.findMany.mockResolvedValueOnce([sampleLog]);
    prismaMock.auditRecord.count.mockResolvedValueOnce(1);

    const result = await auditLogQueryService.list(AUDITOR_CONTEXT, { page: 1, pageSize: 20 });

    expect(result.logs[0]?.user?.email).toBe('j***@cni.hn');
    expect(result.logs[0]?.description).toContain('j***@cni.hn');
    expect(result.logs[0]?.previousData).toEqual({ email: 'j***@cni.hn' });
    expect(result.logs[0]?.newData).toEqual({ email: 'j***@cni.hn' });
  });

  it('returns full emails for ADMIN when users.read is granted', async () => {
    mockRolePermissions('ADMIN', true);
    prismaMock.auditRecord.findMany.mockResolvedValueOnce([sampleLog]);
    prismaMock.auditRecord.count.mockResolvedValueOnce(1);

    const result = await auditLogQueryService.list(ADMIN_CONTEXT, { page: 1, pageSize: 20 });

    expect(result.logs[0]?.user?.email).toBe('juan@cni.hn');
    expect(result.logs[0]?.description).toBe('Contacto juan@cni.hn');
    expect(result.logs[0]?.newData).toEqual({ email: 'juan.nuevo@cni.hn' });
  });
});
