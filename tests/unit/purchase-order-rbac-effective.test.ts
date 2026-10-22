import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '@/platform/api/with-auth';
import { canWithOverrides, organizationRole } from '@/platform/security/authorization/permissions';
import { officialPermissionSetForRole } from '@/platform/security/authorization/official-role-permissions';
import { canOrdenAction } from '@/modules/purchases/domain/purchase-order-permissions';
import { resolveCompraOrdenDetailMessage } from '@/components/compras/CompraOrdenLoadError';

const getCompraOrdenMock = vi.fn();
const loadEffectivePermissionsMock = vi.fn();

vi.mock('@/platform/api/with-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/platform/security/authorization/http', () => ({
  authorizeOrganization: vi.fn(async () => ({
    organizationId: 'org-1',
    userId: 'director-1',
    role: 'DIRECTOR',
  })),
}));

vi.mock('@/modules/purchases/presentation/purchase-order-effective-permissions', () => ({
  loadEffectivePermissions: (...args: unknown[]) => loadEffectivePermissionsMock(...args),
}));

vi.mock('@/modules/purchases/application/purchase-order-use-cases', () => ({
  getCompraOrden: (...args: unknown[]) => getCompraOrdenMock(...args),
  updateCompraOrden: vi.fn(),
  deleteCompraOrden: vi.fn(),
}));

const { GET } = await import('@/app/api/compras/ordenes/[id]/route');

function request(): AuthenticatedRequest {
  return {
    user: { userId: 'director-1', role: 'DIRECTOR' },
  } as AuthenticatedRequest;
}

describe('Compras RBAC efectivo — GET /api/compras/ordenes/[id]', () => {
  beforeEach(() => {
    getCompraOrdenMock.mockReset();
    loadEffectivePermissionsMock.mockReset();
    getCompraOrdenMock.mockResolvedValue({
      id: 'order-1',
      createdById: 'other-user',
      status: 'ISSUED',
    });
  });

  it('DIRECTOR con override ALLOW purchase-orders.read obtiene 200', async () => {
    const roleHas = () => false;
    const overrides = [{ permission: 'purchase-orders.read' as const, effect: 'ALLOW' as const }];
    const effective = new Set(
      (['purchase-orders.read'] as const).filter((permission) =>
        canWithOverrides(organizationRole('DIRECTOR'), permission, overrides, roleHas),
      ),
    );
    loadEffectivePermissionsMock.mockResolvedValue(effective);

    const response = await GET(request(), { params: Promise.resolve({ id: 'order-1' }) });
    expect(response.status).toBe(200);
  });

  it('DIRECTOR sin purchase-orders.read obtiene 403', async () => {
    loadEffectivePermissionsMock.mockResolvedValue(officialPermissionSetForRole('DIRECTOR'));

    const response = await GET(request(), { params: Promise.resolve({ id: 'order-1' }) });
    expect(response.status).toBe(403);
  });

  it('USER solo puede leer órdenes propias; no update/delete/generar sin permisos', () => {
    const userPerms = officialPermissionSetForRole('USER');

    expect(
      canOrdenAction(userPerms, 'read', { membershipRole: 'USER', isCreator: true, status: 'DRAFT' }),
    ).toBe(true);
    expect(
      canOrdenAction(userPerms, 'read', { membershipRole: 'USER', isCreator: false, status: 'DRAFT' }),
    ).toBe(false);
    expect(canOrdenAction(userPerms, 'update', { isCreator: true, status: 'DRAFT' })).toBe(false);
    expect(canOrdenAction(userPerms, 'delete', { isCreator: true, status: 'DRAFT' })).toBe(false);
    expect(canOrdenAction(userPerms, 'generar', { isCreator: true, status: 'DRAFT' })).toBe(false);
  });

  it('PROCUREMENT puede update/delete/generar borradores ajenos; no editar plantilla', () => {
    const procurementPerms = officialPermissionSetForRole('PROCUREMENT');
    const ctx = {
      membershipRole: 'PROCUREMENT' as const,
      sessionRole: 'PROCUREMENT',
      isCreator: false,
      status: 'DRAFT' as const,
    };

    expect(canOrdenAction(procurementPerms, 'update', ctx)).toBe(true);
    expect(canOrdenAction(procurementPerms, 'delete', ctx)).toBe(true);
    expect(canOrdenAction(procurementPerms, 'generar', ctx)).toBe(true);
    expect(canOrdenAction(procurementPerms, 'template', ctx)).toBe(false);
  });

  it('mensaje de detalle para 403 y 404', () => {
    expect(resolveCompraOrdenDetailMessage({ response: { status: 403, data: {} } })).toBe(
      'No tienes permiso para ver esta orden.',
    );
    expect(resolveCompraOrdenDetailMessage({ response: { status: 404, data: {} } })).toBe(
      'La orden no existe.',
    );
  });
});
