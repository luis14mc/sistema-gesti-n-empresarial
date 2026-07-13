import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import type { Role } from '@/types';
import {
  getDocumentoActivoSolicitud,
  readDocumentoBuffer,
} from '@/services/compras-pdf.service';
import { canAccessCompraDocument } from '@/lib/compras/document-access';
import { logCompraAudit } from '@/lib/compras/audit';
import { COMPRA_AUDIT } from '@/lib/compras/audit-actions';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withAuth(async (req: AuthenticatedRequest, context: RouteContext) => {
  try {
    const { id } = await context.params;
    const role = req.user!.role as Role;

    const allowed = await canAccessCompraDocument(req.user!.userId, role, id);
    if (!allowed) {
      return NextResponse.json({ error: 'Sin permisos para descargar el documento' }, { status: 403 });
    }

    const documento = await getDocumentoActivoSolicitud(id);
    if (!documento) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const disposition = searchParams.get('download') === '1' ? 'attachment' : 'inline';
    const buffer = await readDocumentoBuffer(documento);

    await logCompraAudit({
      userId: req.user!.userId,
      solicitudId: id,
      documentoId: documento.id,
      action:
        disposition === 'attachment'
          ? COMPRA_AUDIT.DOCUMENTO_DESCARGADO
          : COMPRA_AUDIT.DOCUMENTO_VISUALIZADO,
      detalles: documento.nombreArchivo,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${documento.nombreArchivo}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('Error downloading compra documento:', error);
    return NextResponse.json({ error: 'Error al descargar documento' }, { status: 500 });
  }
});
