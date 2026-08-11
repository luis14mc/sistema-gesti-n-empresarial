import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '@/lib/middleware';

const mocks = vi.hoisted(() => ({ findUser: vi.fn(), findMemberships: vi.fn(), recordDenied: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findFirst: mocks.findUser },
    organizationMembership: { findMany: mocks.findMemberships },
  },
}));
vi.mock('@/platform/security/audit/security-events', () => ({
  recordSecurityEventBestEffort: mocks.recordDenied,
}));

import { requireOrganizationContext } from '@/modules/organizations/application/context';

function request(selectedOrganizationId?: string): AuthenticatedRequest {
  return {
    user: { userId: 'user-a', email: 'a@example.com', role: 'USER' },
    headers: new Headers(),
    cookies: { get: (name: string) => name === 'organizationId' && selectedOrganizationId ? { value: selectedOrganizationId } : undefined },
  } as unknown as AuthenticatedRequest;
}

const membership = (organizationId: string) => ({
  id: `membership-${organizationId}`,
  organizationId,
  userId: 'user-a',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  organization: { id: organizationId, slug: organizationId, status: 'ACTIVE', timezone: 'America/Tegucigalpa' },
});

describe('requireOrganizationContext', () => {
  beforeEach(() => {
    mocks.findUser.mockReset().mockResolvedValue({ id: 'user-a', email: 'a@example.com' });
    mocks.findMemberships.mockReset();
    mocks.recordDenied.mockReset().mockResolvedValue(undefined);
  });

  it('automatically selects the only active membership', async () => {
    mocks.findMemberships.mockResolvedValue([membership('org-a')]);
    await expect(requireOrganizationContext(request(), 'request-1')).resolves.toEqual({
      authorizationScope: 'organization', userId: 'user-a', organizationId: 'org-a', organizationSlug: 'org-a', timezone: 'America/Tegucigalpa', membershipId: 'membership-org-a', role: 'USER',
    });
  });

  it('uses a selected organization only after membership validation', async () => {
    mocks.findMemberships.mockResolvedValue([membership('org-a'), membership('org-b')]);
    await expect(requireOrganizationContext(request('org-b'), 'request-2')).resolves.toMatchObject({ organizationId: 'org-b' });
  });

  it('requires selection when multiple memberships are active', async () => {
    mocks.findMemberships.mockResolvedValue([membership('org-a'), membership('org-b')]);
    await expect(requireOrganizationContext(request(), 'request-3')).rejects.toMatchObject({ code: 'ORGANIZATION_SELECTION_REQUIRED', status: 409 });
  });

  it('returns controlled membership and cross-tenant errors', async () => {
    mocks.findMemberships.mockResolvedValue([]);
    await expect(requireOrganizationContext(request(), 'request-4')).rejects.toMatchObject({ code: 'ORGANIZATION_MEMBERSHIP_REQUIRED', status: 403 });
    mocks.findMemberships.mockResolvedValue([membership('org-a')]);
    await expect(requireOrganizationContext(request('org-b'), 'request-5')).rejects.toMatchObject({ code: 'TENANT_ACCESS_DENIED', status: 403 });
    expect(mocks.recordDenied).toHaveBeenLastCalledWith(expect.objectContaining({
      eventType: 'tenant.context.denied', outcome: 'DENIED', reasonCode: 'SELECTED_ORGANIZATION_NOT_ALLOWED',
    }));
  });
});
