import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '@/lib/middleware';

const INTERNAL = 'SENSITIVE_REPO_FAILURE_XYZ';

const listSuppliersMock = vi.fn();
const createProveedorMock = vi.fn();
const updateProveedorMock = vi.fn();
const deleteProveedorMock = vi.fn();

vi.mock('@/modules/purchases/application/suppliers', () => ({
  listSuppliers: (...args: unknown[]) => listSuppliersMock(...args),
  createProveedor: (...args: unknown[]) => createProveedorMock(...args),
  updateProveedor: (...args: unknown[]) => updateProveedorMock(...args),
  deleteProveedor: (...args: unknown[]) => deleteProveedorMock(...args),
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

import { GET, POST } from '@/app/api/compras/proveedores/route';
import { PATCH, DELETE } from '@/app/api/compras/proveedores/[id]/route';

function authRequest(init: { method?: string; body?: unknown; url?: string }): AuthenticatedRequest {
  const url = init.url ?? 'http://localhost/api/compras/proveedores';
  return {
    user: { userId: 'user-1', role: 'ADMIN' },
    url,
    json: async () => init.body,
  } as AuthenticatedRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  const err = new Error(INTERNAL);
  listSuppliersMock.mockRejectedValue(err);
  createProveedorMock.mockRejectedValue(err);
  updateProveedorMock.mockRejectedValue(err);
  deleteProveedorMock.mockRejectedValue(err);
});

describe('proveedores API unexpected errors', () => {
  it('GET returns fixed 500 without leaking repository message', async () => {
    const res = await GET(authRequest({ url: 'http://localhost/api/compras/proveedores?page=1' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Error al listar proveedores' });
    expect(JSON.stringify(body)).not.toContain(INTERNAL);
  });

  it('POST returns fixed 500 without leaking repository message', async () => {
    const res = await POST(
      authRequest({
        body: { nombreRazonSocial: 'Proveedor Test SA' },
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Error al crear proveedor' });
    expect(JSON.stringify(body)).not.toContain(INTERNAL);
  });

  it('PATCH returns fixed 500 without leaking repository message', async () => {
    const res = await PATCH(authRequest({ body: { nombreRazonSocial: 'Updated SA' } }), {
      params: Promise.resolve({ id: 'prov-1' }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Error al actualizar proveedor' });
    expect(JSON.stringify(body)).not.toContain(INTERNAL);
  });

  it('DELETE returns fixed 500 without leaking repository message', async () => {
    const res = await DELETE(authRequest({}), {
      params: Promise.resolve({ id: 'prov-1' }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Error al eliminar proveedor' });
    expect(JSON.stringify(body)).not.toContain(INTERNAL);
  });
});
