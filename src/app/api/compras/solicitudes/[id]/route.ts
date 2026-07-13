import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import type { Role } from '@/types';
import { compraInclude, updateCompraSolicitud } from '@/lib/compras/service';
import { updateCompraSolicitudSchema } from '@/lib/compras/schemas';
import { logCompraAudit } from '@/lib/compras/audit';
import { COMPRA_AUDIT } from '@/lib/compras/audit-actions';
import {
  generarPdfSolicitudCompra,
  toDocumentoResponse,
} from '@/services/compras-pdf.service';
import { canEditMontos, isCompraEditable } from '@/lib/compras/validation';

type RouteContext = { params: Promise<{ id: string }> };

async function getHandler(req: AuthenticatedRequest, context: RouteContext) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'purchases', 'read')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await context.params;
    const solicitud = await prisma.compraSolicitud.findFirst({
      where: { id, deletedAt: null },
      include: compraInclude,
    });

    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ solicitud });
  } catch (error) {
    console.error('Error getting compra solicitud:', error);
    return NextResponse.json({ error: 'Error al obtener solicitud' }, { status: 500 });
  }
}

async function patchHandler(req: AuthenticatedRequest, context: RouteContext) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'purchases', 'update')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await context.params;
    const existing = await prisma.compraSolicitud.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });

    const isOwner = existing.solicitadoPorId === req.user!.userId;
    if (!isCompraEditable(existing.estado) && role !== 'ADMIN') {
      return NextResponse.json({ error: 'La solicitud no es editable en este estado' }, { status: 400 });
    }
    if (existing.estado === 'BORRADOR' && !isOwner && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo el solicitante puede editar el borrador' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateCompraSolicitudSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    }

    if ((parsed.data.items || parsed.data.descuento !== undefined) && !canEditMontos(existing.estado, role)) {
      return NextResponse.json({ error: 'No puede editar montos en este estado' }, { status: 400 });
    }

    const solicitud = await updateCompraSolicitud(id, parsed.data, req.user!.userId, role);
    let documento = null;
    try {
      const generated = await generarPdfSolicitudCompra(id, req.user!.userId, {
        auditAction: COMPRA_AUDIT.DOCUMENTO_REGENERADO,
      });
      documento = toDocumentoResponse(generated, id);
    } catch (pdfError) {
      console.error('Error regenerating PDF on update:', pdfError);
    }
    await logCompraAudit({
      userId: req.user!.userId,
      solicitudId: id,
      action: 'compra_solicitud_editada',
      estadoAnterior: existing.estado,
      estadoNuevo: solicitud.estado,
      previousData: existing,
      newData: solicitud,
    });

    return NextResponse.json({ solicitud, documento });
  } catch (error) {
    console.error('Error updating compra solicitud:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar solicitud' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
