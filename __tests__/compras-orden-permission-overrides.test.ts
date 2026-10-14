import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canOrdenAction } from '@/lib/compras/orden/permissions';

const { canForOrganizationMock } = vi.hoisted(() => ({
  canForOrganizationMock: vi.fn(),
}));

vi.mock('@/platform/security/authorization/effective-permissions', () => ({
  canForOrganization: canForOrganizationMock,
}));

describe('canOrdenAction with UserPermissionOverride', () => {
  const auth = {
    userId: 'user-1',
    organizationId: 'org-1',
    organizationRole: 'IT_MANAGER' as const,
  };

  beforeEach(() => {
    canForOrganizationMock.mockReset();
  });

  it('allows read and create for TI when overrides grant purchase capabilities', async () => {
    canForOrganizationMock.mockImplementation(async (_uid, _oid, _role, permission: string) => {
      return permission === 'purchase-orders.read' || permission === 'purchase-orders.create';
    });

    expect(await canOrdenAction('IT', 'read', {}, auth)).toBe(true);
    expect(await canOrdenAction('IT', 'create', {}, auth)).toBe(true);
  });

  it('denies when effective permission check fails even for ADMINISTRACION session role', async () => {
    canForOrganizationMock.mockResolvedValue(false);
    expect(await canOrdenAction('ADMINISTRACION', 'read', {}, auth)).toBe(false);
  });
});
