import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { AuthenticatedRequest } from '@/lib/middleware';

const listMock = vi.fn();

vi.mock('@/lib/compras/orden/service', () => ({
  listCompraOrdenes: (...args: unknown[]) => listMock(...args),
  createCompraOrden: vi.fn(),
}));

vi.mock('@/lib/middleware', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/platform/security/authorization/http', () => ({
  authorizeOrganization: vi.fn(async () => ({
    organizationId: 'org-1',
    userId: 'user-1',
    role: 'ADMIN',
  })),
}));

import { GET } from '@/app/api/compras/ordenes/route';

function request(url: string): AuthenticatedRequest {
  return {
    user: { userId: 'user-1', role: 'ADMIN' },
    url,
  } as AuthenticatedRequest;
}

beforeEach(() => {
  listMock.mockReset();
  listMock.mockResolvedValue({ ordenes: [], total: 0, page: 1, pageSize: 10, totalPages: 1 });
});

describe('GET /api/compras/ordenes', () => {
  it('filters DRAFT when status=DRAFT', async () => {
    await GET(request('http://localhost/api/compras/ordenes?status=DRAFT'));
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DRAFT', statusIn: undefined }),
    );
  });

  it('defaults to active generated statuses when status omitted', async () => {
    await GET(request('http://localhost/api/compras/ordenes'));
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusIn: ['GENERATED', 'ISSUED'] }),
    );
  });
});
