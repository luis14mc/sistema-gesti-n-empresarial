import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '@/platform/api/with-auth';
import { PurchaseBusinessError } from '@/modules/purchases/domain/errors';

const createMock = vi.fn();

vi.mock('@/platform/api/with-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/platform/security/authorization/http', () => ({
  authorizeOrganization: vi.fn(async () => ({ organizationId: 'org-1', userId: 'user-1', role: 'ADMIN' })),
}));

vi.mock('@/modules/purchases/presentation/purchase-order-effective-permissions', () => ({
  loadEffectivePermissions: vi.fn(async () => new Set(['purchase-orders.create'])),
}));

vi.mock('@/modules/purchases/application/purchase-order-use-cases', () => ({
  listCompraOrdenes: vi.fn(),
  createCompraOrden: (...args: unknown[]) => createMock(...args),
}));

const { POST: postLogo } = await import('@/app/api/compras/institucion/logo/route');
const { POST: postOrder } = await import('@/app/api/compras/ordenes/route');

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function logoRequest(file: File): AuthenticatedRequest {
  const form = new FormData();
  form.set('file', file);
  return {
    user: { userId: 'user-1', role: 'ADMIN' },
    formData: async () => form,
  } as unknown as AuthenticatedRequest;
}

function orderRequest(): AuthenticatedRequest {
  return {
    user: { userId: 'user-1', role: 'ADMIN' },
    json: async () => ({
      supplierId: 'sup-1',
      requesterEmployeeId: 'emp-1',
      items: [{ description: 'Papel', unit: 'UNIT', quantity: 1, unitPrice: 100 }],
    }),
  } as unknown as AuthenticatedRequest;
}

describe('compras con NODE_ENV=production: errores de negocio visibles, técnicos ocultos', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('logo de 3 MB responde "El logo no puede superar 2 MB."', async () => {
    const big = new File([Buffer.concat([PNG_HEADER, Buffer.alloc(3 * 1024 * 1024)])], 'logo.png', { type: 'image/png' });
    const response = await postLogo(logoRequest(big));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'El logo no puede superar 2 MB.' });
  });

  it('logo SVG responde el mensaje de formato', async () => {
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'logo.svg', { type: 'image/svg+xml' });
    const response = await postLogo(logoRequest(svg));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Formato de logo no permitido. Use PNG, JPG o WebP.' });
  });

  it('crear orden sin plantilla activa responde "No hay plantilla activa configurada"', async () => {
    createMock.mockRejectedValue(new PurchaseBusinessError('No hay plantilla activa configurada', 500));
    const response = await postOrder(orderRequest());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'No hay plantilla activa configurada' });
  });

  it('un error de Prisma responde "Error interno del servidor" sin código ni meta', async () => {
    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`order_number`)', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['order_number'] },
      }),
    );
    const response = await postOrder(orderRequest());
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toEqual({ error: 'Error interno del servidor', requestId: expect.any(String) });
    expect(body).not.toHaveProperty('code');
    expect(body).not.toHaveProperty('meta');
  });
});
