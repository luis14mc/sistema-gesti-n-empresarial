import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import type { CompraWorkflowAction } from '@/lib/compras/workflow';

/**
 * Helper para endpoints legacy de /api/compras/solicitudes/*.
 *
 * SECURITY (S1): Esta helper ahora retorna 410 Gone inmediatamente.
 *
 * El modelo `CompraSolicitud` no tiene `organizationId` (ver auditoría S1),
 * lo que provoca IDOR cross-tenant: cualquier usuario con `purchases.read`
 * puede listar/editar/anular solicitudes de cualquier organización.
 *
 * La API activa es `/api/compras/ordenes/*` (modelo `CompraOrden`, ya
 * multi-tenant). El frontend activo (`useCompraOrden`) usa exclusivamente
 * los endpoints nuevos.
 *
 * Si algún consumer interno aún llama estos endpoints, debe migrarse a
 * `/api/compras/ordenes`. Esta respuesta 410 explícita evita exponer el bug.
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
          'Deprecation': 'true',
          'Sunset': 'Tue, 01 Jan 2025 00:00:00 GMT',
          'Link': '</api/compras/ordenes>; rel="successor-version"',
        },
      }
    );
  }

  return withAuth(handler);
}
