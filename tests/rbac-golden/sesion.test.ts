import { describe, expect, it, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { AuthenticatedRequest } from '@/lib/middleware';
import { ORGANIZATION_ROLES } from '@/platform/security/authorization/permissions';

const prismaMock = {
  user: { findUnique: vi.fn(), update: vi.fn() },
  organizationMembership: { findUnique: vi.fn(), count: vi.fn() },
  userPermissionOverride: { findMany: vi.fn() },
  rolePermission: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock)),
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/platform/security/organization-scope', () => ({
  canonicalOrganizationId: () => 'org-default',
}));

const loadOrganizationRolePermissionMap = vi.fn();
const createRolePermissionCheck = vi.fn();
const getRoleSettingRow = vi.fn();
const authorizeOrganization = vi.fn();
const bumpOrganizationRoleAccessVersion = vi.fn();
const loadOrganizationRolePermissionMapUncached = vi.fn();
const isRoleMatrixModified = vi.fn();
const buildRoleModuleMatrix = vi.fn();

vi.mock('@/platform/security/authorization/role-permission-service', () => ({
  loadOrganizationRolePermissionMap,
  createRolePermissionCheck,
  bumpOrganizationRoleAccessVersion,
  loadOrganizationRolePermissionMapUncached,
  isRoleMatrixModified,
  effectivePermissionSetForRole: vi.fn(() => new Set(['dashboard.view'])),
}));

vi.mock('@/platform/security/authorization/role-catalog-service', () => ({
  getRoleSettingRow,
}));

vi.mock('@/platform/security/authorization/http', () => ({
  authorizeOrganization,
  authorizationFailure: () => null,
}));

vi.mock('@/platform/security/role-permission-matrix', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/security/role-permission-matrix')>();
  return {
    ...actual,
    buildRoleModuleMatrix: vi.fn(),
  };
});

vi.mock('@/lib/middleware', () => ({
  withAuth: (handler: (req: AuthenticatedRequest, ctx?: unknown) => Promise<Response>) => handler,
}));

vi.mock('@/lib/audit', () => ({ createAuditRecord: vi.fn(async () => undefined) }));

vi.mock('@/platform/security/authorization/session-role', () => ({
  resolveSessionRole: vi.fn(async (_id: string, role: string) => role),
}));

function meRequest(userId: string, accessVersionInToken?: number): AuthenticatedRequest {
  const token = jwt.sign(
    {
      userId,
      email: 'u@test',
      role: 'ADMIN',
      jti: 'j',
      accessVersion: accessVersionInToken,
    },
    'a'.repeat(48),
    { algorithm: 'HS256', expiresIn: '5m', issuer: 'sge', audience: 'sge-web' },
  );
  return {
    user: { userId, email: 'u@test', role: 'ADMIN' },
    cookies: { get: (n: string) => (n === 'token' ? { value: token } : undefined) },
    headers: new Headers(),
  } as unknown as AuthenticatedRequest;
}

describe('RBAC golden — contrato /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'a'.repeat(48);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      employeeNumber: '1',
      email: 'u@test',
      firstName: 'A',
      lastName: 'B',
      phone: null,
      role: 'ADMIN',
      isActive: true,
      mustChangePassword: false,
      departmentId: null,
      positionId: null,
      department: null,
      position: null,
      createdAt: new Date(),
    });
    prismaMock.organizationMembership.findUnique.mockResolvedValue({
      role: 'ADMIN',
      accessVersion: 5,
    });
    prismaMock.userPermissionOverride.findMany.mockResolvedValue([]);
    loadOrganizationRolePermissionMap.mockResolvedValue(null);
    createRolePermissionCheck.mockReturnValue(() => true);
    getRoleSettingRow.mockResolvedValue({ displayName: 'Admin' });
  });

  it('incluye moduleAccess, modulesRead y tokenStale por rol (muestra ADMIN)', async () => {
    const { GET } = await import('@/app/api/auth/me/route');
    const res = await GET(meRequest('u-1', 3));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({
      accessVersion: 5,
      organizationId: expect.any(String),
    });
    expect(Array.isArray(body.user.modulesRead)).toBe(true);
    expect(body.user.moduleAccess).toBeDefined();
    expect(body.tokenStale).toBe(true);
  });

  for (const role of ORGANIZATION_ROLES.slice(0, 3)) {
    it(`estructura de respuesta estable para membershipRole=${role}`, async () => {
      prismaMock.organizationMembership.findUnique.mockResolvedValue({ role, accessVersion: 1 });
      const { GET } = await import('@/app/api/auth/me/route');
      const res = await GET(meRequest('u-1', 1));
      const body = await res.json();
      expect(body.tokenStale).toBe(false);
      expect(Object.keys(body.user)).toEqual(
        expect.arrayContaining(['moduleAccess', 'modulesRead', 'membershipRole', 'accessVersion']),
      );
    });
  }
});

describe('RBAC golden — validez de sesión (accessVersion vs passwordChangedAt)', () => {
  beforeEach(() => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      isActive: true,
      passwordChangedAt: null,
    });
    vi.mocked(prismaMock.organizationMembership.findUnique).mockResolvedValue({
      accessVersion: 99,
      status: 'ACTIVE',
    });
  });

  it('accessVersion viejo en JWT NO revoca la sesión', async () => {
    const { assertTokenSessionStillValid } = await import('@/lib/session-validity');
    const ok = await assertTokenSessionStillValid({
      userId: 'u-1',
      email: 'u@test',
      role: 'ADMIN',
      accessVersion: 1,
      iat: Math.floor(Date.now() / 1000),
    });
    expect(ok).toBe(true);
  });

  it('passwordChangedAt posterior a iat revoca; mismo segundo del cambio sigue válida', async () => {
    const changedAt = new Date('2026-01-15T12:00:00.000Z');
    const changedSec = Math.floor(changedAt.getTime() / 1000);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      isActive: true,
      passwordChangedAt: changedAt,
    });

    const { assertTokenSessionStillValid } = await import('@/lib/session-validity');

    const stale = await assertTokenSessionStillValid({
      userId: 'u-1',
      email: 'u@test',
      role: 'ADMIN',
      iat: changedSec - 1,
      pwdChangedAtMs: changedAt.getTime() - 1000,
    });
    expect(stale).toBe(false);

    const sameSecond = await assertTokenSessionStillValid({
      userId: 'u-1',
      email: 'u@test',
      role: 'ADMIN',
      iat: changedSec,
      pwdChangedAtMs: changedAt.getTime(),
    });
    expect(sameSecond).toBe(true);
  });
});

describe('RBAC golden — PUT matriz de rol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeOrganization.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'admin-1',
      role: 'ADMIN',
    });
    loadOrganizationRolePermissionMap.mockResolvedValue(null);
    loadOrganizationRolePermissionMapUncached.mockResolvedValue(null);
    isRoleMatrixModified.mockReturnValue(true);
    buildRoleModuleMatrix.mockReturnValue({});
    prismaMock.rolePermission.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.rolePermission.createMany.mockResolvedValue({ count: 1 });
    bumpOrganizationRoleAccessVersion.mockResolvedValue(undefined);
  });

  it('rechaza rol vacío (sin permisos tras normalización)', async () => {
    const { PUT } = await import('@/app/api/roles/[role]/permissions/route');
    const req = {
      user: { userId: 'admin-1', email: 'a@test', role: 'ADMIN' },
      json: async () => ({
        rows: [
          {
            module: 'dashboard',
            canRead: false,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            extras: [],
          },
        ],
      }),
    } as unknown as AuthenticatedRequest;

    const res = await PUT(req, { params: Promise.resolve({ role: 'USER' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/al menos un permiso/i);
  });

  it('reemplaza el set completo vía deleteMany + createMany', async () => {
    const { PUT } = await import('@/app/api/roles/[role]/permissions/route');
    const req = {
      user: { userId: 'admin-1', email: 'a@test', role: 'ADMIN' },
      json: async () => ({
        rows: [
          {
            module: 'dashboard',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            extras: [],
          },
        ],
      }),
    } as unknown as AuthenticatedRequest;

    const res = await PUT(req, { params: Promise.resolve({ role: 'USER' }) });
    expect(res.status).toBe(200);
    expect(prismaMock.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', role: 'USER' },
    });
    expect(prismaMock.rolePermission.createMany).toHaveBeenCalled();
  });
});
