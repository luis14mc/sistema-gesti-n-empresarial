import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { AuthenticatedRequest } from '@/lib/middleware';

const prismaMock = vi.hoisted(() => ({
  equipment: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  employee: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('@/lib/middleware', () => ({
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
      role: req.user!.role,
    })),
  };
});

vi.mock('@/platform/security/authorization/effective-permissions', () => ({
  requireOrganizationPermission: vi.fn(async () => undefined),
}));

import { GET } from '@/app/api/equipment/route';

function getRequest(url: string, role = 'ADMIN'): AuthenticatedRequest {
  const req = new NextRequest(new URL(url, 'http://localhost')) as AuthenticatedRequest;
  req.user = { userId: 'user-1', email: 'admin@cni.hn', role };
  return req;
}

beforeEach(() => {
  prismaMock.equipment.findMany.mockResolvedValue([]);
  prismaMock.equipment.count.mockResolvedValue(0);
  prismaMock.employee.findFirst.mockResolvedValue(null);
});

describe('GET /api/equipment query validation', () => {
  it('rejects pageSize above 100 with 400', async () => {
    const response = await GET(getRequest('/api/equipment?pageSize=200'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_EQUIPMENT_QUERY');
    expect(prismaMock.equipment.findMany).not.toHaveBeenCalled();
  });

  it('documents max pageSize=100 as valid', async () => {
    const response = await GET(getRequest('/api/equipment?pageSize=100&page=1'));
    expect(response.status).toBe(200);
    expect(prismaMock.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100, skip: 0 }),
    );
  });
});

describe('GET /api/equipment filters', () => {
  it('applies status=AVAILABLE and case-insensitive search on inventory, brand, model and serial', async () => {
    await GET(getRequest('/api/equipment?status=AVAILABLE&search=laptop&pageSize=50'));

    expect(prismaMock.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          status: 'AVAILABLE',
          AND: [
            {
              OR: [
                { inventoryCode: { contains: 'laptop', mode: 'insensitive' } },
                { brand: { contains: 'laptop', mode: 'insensitive' } },
                { model: { contains: 'laptop', mode: 'insensitive' } },
                { serialNumber: { contains: 'laptop', mode: 'insensitive' } },
              ],
            },
          ],
        }),
        take: 50,
      }),
    );
  });
});
