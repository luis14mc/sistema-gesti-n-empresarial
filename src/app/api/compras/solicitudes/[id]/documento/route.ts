import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import type { Role } from '@/types';
import {
  getDocumentoActivoSolicitud,
  solicitudTieneErrorDocumento,
  toDocumentoResponse,
} from '@/services/compras-pdf.service';
import { canAccessCompraDocument } from '@/lib/compras/document-access';
import { resolveDocumentoEstadoFromDocs } from '@/lib/compras/document-metadata';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withAuth(async (req: AuthenticatedRequest, context: RouteContext) => {
  try {
    const { id } = await context.params;
    const role = req.user!.role as Role;

    const allowed = await canAccessCompraDocument(req.user!.userId, role, id);
    if (!allowed) {
      return NextResponse.json({ error: 'Sin permisos para ver el documento' }, { status: 403 });
    }

    const documento = await getDocumentoActivoSolicitud(id);
    if (!documento) {
      const hasError = await solicitudTieneErrorDocumento(id);
      return NextResponse.json({
        documento: null,
        documentoEstado: resolveDocumentoEstadoFromDocs([], hasError),
      });
    }

    return NextResponse.json({
      documento: toDocumentoResponse(documento, id),
      documentoEstado: 'generado',
    });
  } catch (error) {
    console.error('Error getting compra documento metadata:', error);
    return NextResponse.json({ error: 'Error al obtener documento' }, { status: 500 });
  }
});
