import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '@/platform/api/with-auth';
import { PermissionDeniedError } from '@/platform/domain/errors';

const authorizeOrganizationMock = vi.fn();
const getEmployeeActiveAssetsMock = vi.fn();

vi.mock('@/platform/api/with-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/platform/security/authorization/http', () => ({
  authorizeOrganization: (...args: unknown[]) => authorizeOrganizationMock(...args),
}));

vi.mock('@/modules/people/application/employees-service', () => ({
  getEmployeeActiveAssets: (...args: unknown[]) => getEmployeeActiveAssetsMock(...args),
}));

const { GET } = await import('@/app/api/employees/[id]/assets/route');

function request(): AuthenticatedRequest {
  return { user: { userId: 'user-1', role: 'ADMIN' } } as AuthenticatedRequest;
}

describe('GET /api/employees/[id]/assets', () => {
  beforeEach(() => {
    authorizeOrganizationMock.mockReset();
    getEmployeeActiveAssetsMock.mockReset();
  });

  it('403 sin equipment.read', async () => {
    authorizeOrganizationMock.mockRejectedValue(new PermissionDeniedError('Sin permiso'));
    const response = await GET(request(), { params: Promise.resolve({ id: 'emp-1' }) });
    expect(response.status).toBe(403);
    expect(getEmployeeActiveAssetsMock).not.toHaveBeenCalled();
  });

  it('200 con equipment.read devuelve activos', async () => {
    authorizeOrganizationMock.mockResolvedValue({ organizationId: 'org-1', userId: 'user-1' });
    getEmployeeActiveAssetsMock.mockResolvedValue({
      employee: { id: 'emp-1', fullName: 'Ana', employeeCode: 'E-1', isActive: true },
      equipos: [],
      licencias: [],
    });
    const response = await GET(request(), { params: Promise.resolve({ id: 'emp-1' }) });
    expect(response.status).toBe(200);
    expect(authorizeOrganizationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'equipment.read',
    );
    const body = await response.json();
    expect(body.employee.id).toBe('emp-1');
  });
});
