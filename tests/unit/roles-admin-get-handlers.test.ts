import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AuthenticatedRequest } from '@/lib/middleware';
import { ORGANIZATION_ROLES } from '@/platform/security/authorization/permissions';

const authorizeOrganization = vi.fn();
const getRoleSettingRow = vi.fn();
const loadOrganizationRolePermissionMap = vi.fn();
const buildRoleModuleMatrix = vi.fn();
const isRoleMatrixModified = vi.fn();

vi.mock('@/platform/security/authorization/http', () => ({
  authorizeOrganization,
  authorizationFailure: () => null,
}));

vi.mock('@/platform/security/authorization/role-catalog-service', () => ({
  getRoleSettingRow,
}));

vi.mock('@/platform/security/authorization/role-permission-service', () => ({
  loadOrganizationRolePermissionMap,
  isRoleMatrixModified,
}));

vi.mock('@/platform/security/role-permission-matrix', () => ({
  buildRoleModuleMatrix,
  permissionsFromRoleModuleRows: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    organizationMembership: { count: vi.fn(async () => 0) },
  },
}));

vi.mock('@/lib/middleware', () => ({
  withAuth: (handler: (req: AuthenticatedRequest, ctx: unknown) => Promise<Response>) => handler,
}));

function adminRequest(): AuthenticatedRequest {
  return {
    user: { userId: 'admin-1', email: 'a@test', role: 'ADMIN' },
    headers: new Headers(),
    cookies: { get: () => undefined },
  } as unknown as AuthenticatedRequest;
}

describe('GET /api/roles/[role] handlers for ADMIN', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeOrganization.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'admin-1',
      role: 'ADMIN',
    });
    getRoleSettingRow.mockResolvedValue({
      displayName: 'Test',
      description: null,
      assignable: true,
    });
    loadOrganizationRolePermissionMap.mockResolvedValue(null);
    isRoleMatrixModified.mockReturnValue(false);
    buildRoleModuleMatrix.mockReturnValue({});
  });

  it('returns 200 for permissions and settings on every organization role including PROCUREMENT', async () => {
    const { GET: getPermissions } = await import('@/app/api/roles/[role]/permissions/route');
    const { GET: getSettings } = await import('@/app/api/roles/[role]/settings/route');

    for (const role of ORGANIZATION_ROLES) {
      const permRes = await getPermissions(adminRequest(), {
        params: Promise.resolve({ role }),
      });
      expect(permRes.status, `permissions ${role}`).toBe(200);

      const settingsRes = await getSettings(adminRequest(), {
        params: Promise.resolve({ role }),
      });
      expect(settingsRes.status, `settings ${role}`).toBe(200);
    }
  });
});
