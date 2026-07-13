import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import type { Role } from '@/types';
import { compraInclude } from '@/lib/compras/service';
import { buildCompraPdfHtml } from '@/lib/compras/pdf';
import { canAccessCompraDocument } from '@/lib/compras/document-access';

type RouteContext = { params: Promise<{ id: string }> };

async function getHandler(req: AuthenticatedRequest, context: RouteContext) {
  try {
    const role = req.user!.role as Role;
    const { id } = await context.params;

    const allowed = await canAccessCompraDocument(req.user!.userId, role, id);
    if (!allowed) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const solicitud = await prisma.compraSolicitud.findFirst({
      where: { id, deletedAt: null },
      include: compraInclude,
    });

    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    const html = await buildCompraPdfHtml(solicitud);
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${solicitud.codigoSolicitud}.html"`,
      },
    });
  } catch (error) {
    console.error('Error generating compra preview HTML:', error);
    return NextResponse.json({ error: 'Error al generar vista previa' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
