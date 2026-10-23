import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '@/platform/api/with-auth';
import { PermissionDeniedError } from '@/platform/domain/errors';

const authorizeOrganizationMock = vi.fn();
const deleteSeatMock = vi.fn();
const deleteSoftwareSubscriptionMock = vi.fn();

vi.mock('@/platform/api/with-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/platform/security/authorization/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/security/authorization/http')>();
  return {
    ...actual,
    authorizeOrganization: (...args: unknown[]) => authorizeOrganizationMock(...args),
  };
});

vi.mock('@/modules/software-licenses/application/service', () => ({
  deleteSeat: (...args: unknown[]) => deleteSeatMock(...args),
  deleteSoftwareSubscription: (...args: unknown[]) => deleteSoftwareSubscriptionMock(...args),
  updateSeat: vi.fn(),
  getSoftwareSubscription: vi.fn(),
  updateSoftwareSubscription: vi.fn(),
}));

const { DELETE: deleteSeatRoute } = await import('@/app/api/software-licenses/seats/[seatId]/route');
const { DELETE: deleteSubscriptionRoute } = await import('@/app/api/software-licenses/[id]/route');

function request(): AuthenticatedRequest {
  return { user: { userId: 'user-1', role: 'IT' } } as AuthenticatedRequest;
}

const orgContext = {
  organizationId: 'org-1',
  userId: 'user-1',
  role: 'IT' as const,
};

describe('DELETE licencias — permisos API', () => {
  beforeEach(() => {
    authorizeOrganizationMock.mockReset();
    deleteSeatMock.mockReset();
    deleteSoftwareSubscriptionMock.mockReset();
    authorizeOrganizationMock.mockResolvedValue(orgContext);
  });

  it('403 DELETE asiento sin software-licenses.manage', async () => {
    authorizeOrganizationMock.mockRejectedValue(new PermissionDeniedError('Sin permiso'));
    const response = await deleteSeatRoute(request(), { params: Promise.resolve({ seatId: 'seat-1' }) });
    expect(response.status).toBe(403);
    expect(deleteSeatMock).not.toHaveBeenCalled();
    expect(authorizeOrganizationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'software-licenses.manage',
    );
  });

  it('403 DELETE suscripción sin software-licenses.manage', async () => {
    authorizeOrganizationMock.mockRejectedValue(new PermissionDeniedError('Sin permiso'));
    const response = await deleteSubscriptionRoute(request(), { params: Promise.resolve({ id: 'sub-1' }) });
    expect(response.status).toBe(403);
    expect(deleteSoftwareSubscriptionMock).not.toHaveBeenCalled();
  });
});
