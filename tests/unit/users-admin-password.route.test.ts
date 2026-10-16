import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AuthenticatedRequest } from '@/lib/middleware';

const authorizeOrganization = vi.fn();
const hashPassword = vi.fn(async (p: string) => `hashed:${p}`);
const createAuditRecord = vi.fn(async () => undefined);

const prismaMock = {
  organizationMembership: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  user: { update: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => {
    for (const op of ops) await op;
  }),
};

vi.mock('@/platform/security/authorization/http', () => ({
  authorizeOrganization,
}));

vi.mock('@/lib/auth', () => ({
  hashPassword,
}));

vi.mock('@/lib/audit', () => ({
  createAuditRecord,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/middleware', () => ({
  withAuth: (handler: (req: AuthenticatedRequest, ctx: unknown) => Promise<Response>) => handler,
}));

function buildRequest(userId: string, body: unknown): AuthenticatedRequest {
  return {
    user: { userId, email: 'admin@test', role: 'ADMIN' },
    json: async () => body,
  } as unknown as AuthenticatedRequest;
}

describe('POST /api/users/[id]/password handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeOrganization.mockResolvedValue({
      organizationId: 'org-1',
      role: 'ADMIN',
    });
  });

  it('returns 403 when admin targets OWNER membership', async () => {
    prismaMock.organizationMembership.findFirst.mockResolvedValue({
      id: 'm1',
      role: 'OWNER',
      user: { email: 'o@test', firstName: 'O', lastName: 'W' },
    });

    const { POST } = await import('@/app/api/users/[id]/password/route');
    const res = await POST(buildRequest('admin-1', { newPassword: 'Secret123', mustChangePassword: true }), {
      params: Promise.resolve({ id: 'owner-1' }),
    });
    expect(res.status).toBe(403);
  });

  it('resets password and audits without storing the password', async () => {
    prismaMock.organizationMembership.findFirst.mockResolvedValue({
      id: 'm2',
      role: 'ADMINISTRACION',
      user: { email: 'u@test', firstName: 'U', lastName: 'Ser' },
    });

    const { POST } = await import('@/app/api/users/[id]/password/route');
    const res = await POST(
      buildRequest('admin-1', { newPassword: 'NewPass123', mustChangePassword: true }),
      { params: Promise.resolve({ id: 'user-2' }) },
    );
    expect(res.status).toBe(200);
    expect(hashPassword).toHaveBeenCalledWith('NewPass123');
    expect(createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'PASSWORD_RESET_BY_ADMIN',
        newData: expect.not.objectContaining({ newPassword: expect.anything() }),
      }),
    );
  });

  it('returns 403 without users.update authorization', async () => {
    const { PermissionDeniedError } = await import('@/platform/domain/errors');
    authorizeOrganization.mockRejectedValue(new PermissionDeniedError('users.update'));

    const { POST } = await import('@/app/api/users/[id]/password/route');
    const res = await POST(buildRequest('user-x', { newPassword: 'NewPass123' }), {
      params: Promise.resolve({ id: 'user-y' }),
    });
    expect(res.status).toBe(403);
  });
});
