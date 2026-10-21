import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import type { CompraWorkflowAction } from '@/modules/purchases/domain/workflow';

/**
 * Helper para endpoints legacy de /api/compras/solicitudes/*.
 *
 * SECURITY (S1): Esta helper ahora retorna 410 Gone inmediatamente.
 */
export function createCompraWorkflowRoute(action: CompraWorkflowAction) {
  async function handler(
    _req: AuthenticatedRequest,
    _ctx: { params: Promise<{ id: string }> }
  ) {
    void action;
    return NextResponse.json(
      {
        error: 'ENDPOINT_DEPRECATED',
        message: 'Las rutas /api/compras/solicitudes/* fueron deshabilitadas por seguridad. Use /api/compras/ordenes/* (multi-tenant).',
        migrationGuide: 'https://docs.example.com/api/compras/migration',
      },
      {
        status: 410,
        headers: {
          Deprecation: 'true',
          Sunset: 'Tue, 01 Jan 2025 00:00:00 GMT',
          Link: '</api/compras/ordenes>; rel="successor-version"',
        },
      }
    );
  }

  return withAuth(handler);
}
