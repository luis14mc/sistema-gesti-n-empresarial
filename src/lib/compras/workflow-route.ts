import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { applyWorkflowAction } from '@/lib/compras/service';
import { canPerformCompraAction, type CompraWorkflowAction } from '@/lib/compras/workflow';
import type { Role } from '@/types';

export function createCompraWorkflowRoute(
  action: CompraWorkflowAction,
  options?: { requireMotivo?: boolean }
) {
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
      const solicitud = await prisma.compraSolicitud.findFirst({
        where: { id, deletedAt: null },
      });
      if (!solicitud) {
        return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
      }

      const isOwner = solicitud.solicitadoPorId === req.user!.userId;
      const reviewer = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { departmentId: true },
      });
      const sameDepartment =
        !!reviewer?.departmentId &&
        reviewer.departmentId === solicitud.departamentoSolicitanteId;

      if (!canPerformCompraAction(role, action, solicitud.estado, { isOwner, sameDepartment })) {
        return NextResponse.json({ error: 'Acción no permitida' }, { status: 403 });
      }

      let extra: { motivoRechazo?: string } | undefined;
      if (options?.requireMotivo) {
        const body = await req.json();
        if (!body.motivoRechazo) {
          return NextResponse.json({ error: 'Motivo de rechazo obligatorio' }, { status: 400 });
        }
        extra = { motivoRechazo: body.motivoRechazo };
      }

      const updated = await applyWorkflowAction(id, action, req.user!.userId, extra);
      return NextResponse.json({ solicitud: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error en workflow';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return withAuth(handler);
}
