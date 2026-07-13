import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import type { Role } from '@/types';
import { COMPRA_AUDIT } from '@/lib/compras/audit-actions';
import {
  generarPdfSolicitudCompra,
  toDocumentoResponse,
} from '@/services/compras-pdf.service';
import { canAccessCompraDocument } from '@/lib/compras/document-access';
import { canRegenerateCompraDocument } from '@/lib/compras/workflow';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withAuth(async (req: AuthenticatedRequest, context: RouteContext) => {
  try {
    const { id } = await context.params;
    const role = req.user!.role as Role;

    const allowed = await canAccessCompraDocument(req.user!.userId, role, id);
    if (!allowed) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const solicitud = await prisma.compraSolicitud.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, estado: true, solicitadoPorId: true },
    });
    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    const isOwner = solicitud.solicitadoPorId === req.user!.userId;
    if (!canRegenerateCompraDocument(solicitud.estado, role, isOwner)) {
      return NextResponse.json(
        { error: 'No puede regenerar el documento en este estado' },
        { status: 400 }
      );
    }

    const documento = await generarPdfSolicitudCompra(id, req.user!.userId, {
      auditAction: COMPRA_AUDIT.DOCUMENTO_REGENERADO,
    });

    return NextResponse.json({
      success: true,
      data: { documento: toDocumentoResponse(documento, id) },
    });
  } catch (error) {
    console.error('Error regenerating compra documento:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al regenerar documento' },
      { status: 500 }
    );
  }
});
