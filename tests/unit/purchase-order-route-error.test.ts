import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePurchaseOrderRouteError } from '@/modules/purchases/infrastructure/purchase-order-prisma-route-error';
import { PurchaseBusinessError, PurchaseNotFoundError } from '@/modules/purchases/domain/errors';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { InvalidUploadError } from '@/platform/security/uploads/raster-image-validation';

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on users_email_key', {
    code,
    clientVersion: 'test',
    meta: { target: ['email'] },
  });
}

describe('handlePurchaseOrderRouteError', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    vi.unstubAllEnvs();
  });

  describe('fuera de development', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
    });

    it.each([
      ['P2002', 409],
      ['P2025', 404],
      ['P2003', 400],
      ['P9999', 500],
    ])('Prisma %s responde mensaje genérico con status %i', async (code, status) => {
      const response = handlePurchaseOrderRouteError(knownError(code), 'GET /api/test', 'req-1');
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: 'Error interno del servidor', requestId: 'req-1' });
    });

    it('validación de Prisma responde 400 sin detalle', async () => {
      const error = new Prisma.PrismaClientValidationError('Argument `where` is missing', { clientVersion: 'test' });
      const response = handlePurchaseOrderRouteError(error, 'GET /api/test', 'req-2');
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Error interno del servidor', requestId: 'req-2' });
    });

    it('error genérico responde 500 sin mensaje ni stack', async () => {
      const response = handlePurchaseOrderRouteError(new Error('connect ECONNREFUSED 10.0.0.5:5432'), 'GET /api/test', 'req-3');
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: 'Error interno del servidor', requestId: 'req-3' });
      expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
    });

    it('genera requestId cuando no se recibe y lo registra en console.error con el detalle', async () => {
      const error = new Error('detalle interno');
      const response = handlePurchaseOrderRouteError(error, 'GET /api/test');
      const body = await response.json();
      expect(body.requestId).toEqual(expect.any(String));
      expect(body.requestId.length).toBeGreaterThan(0);
      expect(consoleError).toHaveBeenCalledWith('[GET /api/test]', { requestId: body.requestId, error });
    });

    it('mantiene 403 y errores de contexto de organización sin cambios', async () => {
      const response = handlePurchaseOrderRouteError(new PermissionDeniedError('Sin permiso'), 'GET /api/test', 'req-4');
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'Sin permiso' });
    });

    it('errores de negocio tipados responden el mensaje original y el status del caso', async () => {
      const template = handlePurchaseOrderRouteError(
        new PurchaseBusinessError('No hay plantilla activa configurada', 500),
        'POST /api/compras/ordenes',
        'req-biz',
      );
      expect(template.status).toBe(500);
      expect(await template.json()).toEqual({ error: 'No hay plantilla activa configurada' });

      const notFound = handlePurchaseOrderRouteError(
        new PurchaseNotFoundError('Orden no encontrada', 400),
        'PATCH /api/compras/ordenes/[id]',
        'req-nf',
      );
      expect(notFound.status).toBe(400);
      expect(await notFound.json()).toEqual({ error: 'Orden no encontrada' });

      const upload = handlePurchaseOrderRouteError(
        new InvalidUploadError('Formato de logo no permitido. Use PNG, JPG o WebP.'),
        'POST /api/compras/institucion/logo',
        'req-up',
      );
      expect(upload.status).toBe(500);
      expect(await upload.json()).toEqual({ error: 'Formato de logo no permitido. Use PNG, JPG o WebP.' });
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe('en development', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });

    it('conserva el detalle de Prisma', async () => {
      const response = handlePurchaseOrderRouteError(knownError('P2002'), 'GET /api/test', 'req-5');
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: 'Unique constraint failed on users_email_key',
        code: 'P2002',
        meta: { target: ['email'] },
        context: 'GET /api/test',
      });
    });

    it('conserva mensaje y stack en errores genéricos', async () => {
      const error = new Error('detalle interno');
      const response = handlePurchaseOrderRouteError(error, 'GET /api/test', 'req-6');
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('detalle interno');
      expect(body.context).toBe('GET /api/test');
      expect(body.stack).toContain('detalle interno');
    });
  });
});
