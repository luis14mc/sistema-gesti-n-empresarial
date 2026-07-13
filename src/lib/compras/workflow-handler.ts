import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { CompraEstado } from '@prisma/client';
import type { Role } from '@/types';
import { compraInclude } from '@/lib/compras/service';
import { logCompraAudit } from '@/lib/compras/audit';
import {
  canPerformCompraAction,
  getNextEstado,
  type CompraWorkflowAction,
} from '@/lib/compras/workflow';
import { workflowActionSchema } from '@/lib/compras/schemas';
import { COMPRA_AUDIT } from '@/lib/compras/audit-actions';
import { generarPdfSolicitudCompra } from '@/services/compras-pdf.service';

interface WorkflowContext {
  userId: string;
  role: Role;
  solicitudId: string;
  action: CompraWorkflowAction;
  body?: unknown;
}

export async function executeCompraWorkflow(ctx: WorkflowContext) {
  const parsedBody = workflowActionSchema.safeParse(ctx.body ?? {});
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const solicitud = await prisma.compraSolicitud.findFirst({
    where: { id: ctx.solicitudId, deletedAt: null },
    select: {
      id: true,
      estado: true,
      proveedorId: true,
      solicitadoPorId: true,
      departamentoSolicitanteId: true,
    },
  });

  if (!solicitud) {
    return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { departmentId: true },
  });

  const nextEstado = getNextEstado(ctx.action, solicitud.estado);
  if (!nextEstado) {
    return NextResponse.json({ error: 'Transición de estado no permitida' }, { status: 400 });
  }

  const allowed = canPerformCompraAction(ctx.role, ctx.action, solicitud.estado, {
    isOwner: solicitud.solicitadoPorId === ctx.userId,
    sameDepartment:
      !!user?.departmentId &&
      user.departmentId === solicitud.departamentoSolicitanteId,
  });

  if (!allowed) {
    return NextResponse.json({ error: 'No tiene permisos para esta acción' }, { status: 403 });
  }

  if (
    (ctx.action === 'rechazar_jefe' || ctx.action === 'rechazar_gerencia') &&
    !parsedBody.data.motivoRechazo
  ) {
    return NextResponse.json({ error: 'Motivo de rechazo obligatorio' }, { status: 400 });
  }

  if (ctx.action === 'emitir_orden') {
    const proveedorId = parsedBody.data.proveedorId ?? solicitud.proveedorId;
    if (!proveedorId) {
      return NextResponse.json({ error: 'Proveedor obligatorio para emitir orden' }, { status: 400 });
    }
  }

  const now = new Date();
  const updateData: Record<string, unknown> = { estado: nextEstado as CompraEstado };

  if (ctx.action === 'autorizar') {
    updateData.autorizadoPorId = ctx.userId;
    updateData.autorizadoEn = now;
  }
  if (ctx.action === 'aprobar') {
    updateData.aprobadoPorId = ctx.userId;
    updateData.aprobadoEn = now;
  }
  if (ctx.action === 'emitir_orden') {
    updateData.emitidoPorId = ctx.userId;
    updateData.emitidoEn = now;
    updateData.proveedorId = parsedBody.data.proveedorId ?? solicitud.proveedorId;
  }
  if (ctx.action === 'rechazar_jefe' || ctx.action === 'rechazar_gerencia') {
    updateData.motivoRechazo = parsedBody.data.motivoRechazo;
  }
  if (ctx.action === 'enviar') {
    const itemsCount = await prisma.compraSolicitudItem.count({ where: { solicitudCompraId: solicitud.id } });
    if (itemsCount === 0) {
      return NextResponse.json({ error: 'Debe incluir al menos un ítem' }, { status: 400 });
    }
  }

  const updated = await prisma.compraSolicitud.update({
    where: { id: solicitud.id },
    data: updateData,
    include: compraInclude,
  });

  await logCompraAudit({
    userId: ctx.userId,
    solicitudId: solicitud.id,
    action: ctx.action.toUpperCase(),
    estadoAnterior: solicitud.estado,
    estadoNuevo: nextEstado,
    detalles: parsedBody.data.motivoRechazo,
    previousData: solicitud,
    newData: updated,
  });

  let documento = null;
  try {
    documento = await generarPdfSolicitudCompra(updated.id, ctx.userId, {
      auditAction: COMPRA_AUDIT.DOCUMENTO_REGENERADO,
    });
  } catch (error) {
    console.error('No se pudo regenerar PDF tras workflow:', error);
  }

  return NextResponse.json({ solicitud: updated, documento });
}
