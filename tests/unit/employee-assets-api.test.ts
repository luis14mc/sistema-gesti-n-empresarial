import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '@/platform/api/with-auth';
import { PermissionDeniedError } from '@/platform/domain/errors';

const authorizeOrganizationMock = vi.fn();
const canForOrganizationMock = vi.fn();
const getEmployeeActiveAssetsMock = vi.fn();

vi.mock('@/platform/api/with-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/platform/security/authorization/http', () => ({
  authorizeOrganization: (...args: unknown[]) => authorizeOrganizationMock(...args),
}));

vi.mock('@/platform/security/authorization/effective-permissions', () => ({
  canForOrganization: (...args: unknown[]) => canForOrganizationMock(...args),
}));

vi.mock('@/modules/people/application/employees-service', () => ({
  getEmployeeActiveAssets: (...args: unknown[]) => getEmployeeActiveAssetsMock(...args),
}));

const { GET } = await import('@/app/api/employees/[id]/assets/route');

function request(): AuthenticatedRequest {
  return { user: { userId: 'user-1', role: 'ADMIN' } } as AuthenticatedRequest;
}

const orgContext = {
  organizationId: 'org-1',
  userId: 'user-1',
  role: 'IT_MANAGER' as const,
};

describe('GET /api/employees/[id]/assets', () => {
  beforeEach(() => {
    authorizeOrganizationMock.mockReset();
    canForOrganizationMock.mockReset();
    getEmployeeActiveAssetsMock.mockReset();
    authorizeOrganizationMock.mockResolvedValue(orgContext);
  });

  it('403 sin equipment.read', async () => {
    authorizeOrganizationMock.mockRejectedValue(new PermissionDeniedError('Sin permiso'));
    const response = await GET(request(), { params: Promise.resolve({ id: 'emp-1' }) });
    expect(response.status).toBe(403);
    expect(getEmployeeActiveAssetsMock).not.toHaveBeenCalled();
  });

  it('200 con equipment.read pero sin software-licenses.read omite licencias', async () => {
    canForOrganizationMock.mockResolvedValue(false);
    getEmployeeActiveAssetsMock.mockResolvedValue({
      employee: { id: 'emp-1', fullName: 'Ana', employeeCode: 'E-1', isActive: true },
      equipos: [{ assignmentId: 'a1', equipmentId: 'eq-1', codigo: 'IT-1', nombre: 'Laptop', asignadoDesde: '2026-01-01', actaEntregaUrl: null }],
      licencias: [],
    });

    const response = await GET(request(), { params: Promise.resolve({ id: 'emp-1' }) });
    expect(response.status).toBe(200);
    expect(canForOrganizationMock).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      'IT_MANAGER',
      'software-licenses.read',
    );
    expect(getEmployeeActiveAssetsMock).toHaveBeenCalledWith('org-1', 'emp-1', {
      includeLicenses: false,
    });
    const body = await response.json();
    expect(body.licencias).toEqual([]);
    expect(body.equipos).toHaveLength(1);
  });

  it('200 con equipment.read y software-licenses.read incluye licencias', async () => {
    canForOrganizationMock.mockResolvedValue(true);
    getEmployeeActiveAssetsMock.mockResolvedValue({
      employee: { id: 'emp-1', fullName: 'Ana', employeeCode: 'E-1', isActive: true },
      equipos: [],
      licencias: [
        {
          assignmentId: 'lic-a1',
          subscriptionId: 'sub-1',
          seatId: 'seat-1',
          producto: 'Microsoft 365',
          plan: 'Business',
          cuenta: 'ana@cni.hn',
          asignadoDesde: '2026-02-01T00:00:00.000Z',
        },
      ],
    });

    const response = await GET(request(), { params: Promise.resolve({ id: 'emp-1' }) });
    expect(response.status).toBe(200);
    expect(getEmployeeActiveAssetsMock).toHaveBeenCalledWith('org-1', 'emp-1', {
      includeLicenses: true,
    });
    const body = await response.json();
    expect(body.licencias).toHaveLength(1);
    expect(body.licencias[0].producto).toBe('Microsoft 365');
  });
});
