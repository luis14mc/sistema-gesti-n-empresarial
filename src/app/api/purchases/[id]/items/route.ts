import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

/**
 * POST /api/purchases/[id]/items
 *
 * Estado: NO IMPLEMENTADO.
 * El modelo PurchaseItem no forma parte del esquema actual.
 *
 * Reservado para fase posterior: gestión de líneas/ítems dentro de una
 * solicitud de compra (cantidad, precio unitario, proveedor, etc.).
 *
 * Retorna 410 Gone para distinguirlo claramente de errores 500 y de
 * los stubs 501 que indican "pendiente de migración".
 */
async function notImplemented(_req: AuthenticatedRequest) {
    return NextResponse.json(
      {
        error: 'Endpoint no disponible',
        reason: 'El sub-recurso items requiere el modelo PurchaseItem, no contemplado en el esquema MVP.',
      },
      { status: 410 }
    );
}

export const POST = withAuth(notImplemented);
