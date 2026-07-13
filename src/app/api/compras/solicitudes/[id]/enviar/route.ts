import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { applyWorkflowAction, compraInclude } from '@/lib/compras/service';
import { validarCompraParaEnviar } from '@/lib/compras/schemas';
import { canPerformCompraAction } from '@/lib/compras/workflow';
import type { Role } from '@/types';

async function postHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'purchases', 'update')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;
    const solicitud = await prisma.compraSolicitud.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });
    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    const isOwner = solicitud.solicitadoPorId === req.user!.userId;
    if (!canPerformCompraAction(role, 'enviar', solicitud.estado, { isOwner })) {
      return NextResponse.json({ error: 'Acción no permitida' }, { status: 403 });
    }

    const errors = validarCompraParaEnviar(solicitud);
    if (errors.length) {
      return NextResponse.json({ error: errors.join('. ') }, { status: 400 });
    }

    const updated = await applyWorkflowAction(id, 'enviar', req.user!.userId);
    return NextResponse.json({ solicitud: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al enviar';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const POST = withAuth(postHandler);
