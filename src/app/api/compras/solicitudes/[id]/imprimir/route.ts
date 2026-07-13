import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { compraInclude } from '@/lib/compras/service';
import { construirHtmlSolicitudCompra } from '@/lib/compras/pdf-template';
import type { Role } from '@/types';

async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'purchases', 'read')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;
    const solicitud = await prisma.compraSolicitud.findFirst({
      where: { id, deletedAt: null },
      include: compraInclude,
    });
    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    const html = await construirHtmlSolicitudCompra(solicitud);
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error generando vista imprimible:', error);
    return NextResponse.json({ error: 'Error al generar vista' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
