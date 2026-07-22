import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { applyWorkflowAction } from '@/lib/compras/service';
import { canPerformCompraAction, type CompraWorkflowAction } from '@/lib/compras/workflow';
import type { Role } from '@/types';

export function createCompraWorkflowRoute(action: CompraWorkflowAction) {
  async function handler(
    req: AuthenticatedRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      const role = req.user!.role as Role;
      if (!canAccess(role, 'purchases', 'update')) {
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
      }

      const { id } = await params;
      const orden = await prisma.compraSolicitud.findFirst({
        where: { id, deletedAt: null },
      });
      if (!orden) {
        return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
      }

      const isOwner = orden.solicitadoPorId === req.user!.userId;
      if (!canPerformCompraAction(role, action, orden.estado, { isOwner })) {
        return NextResponse.json({ error: 'Acción no permitida' }, { status: 403 });
      }

      const updated = await applyWorkflowAction(id, action, req.user!.userId);
      return NextResponse.json({ solicitud: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error en workflow';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return withAuth(handler);
}
