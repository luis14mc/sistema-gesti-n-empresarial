import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { compraInclude, updateCompraSolicitud } from '@/lib/compras/service';
import { updateCompraSolicitudSchema } from '@/lib/compras/schemas';
import { isCompraEditable } from '@/lib/compras/workflow';
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

    return NextResponse.json({ solicitud });
  } catch (error) {
    console.error('Error getting compra solicitud:', error);
    return NextResponse.json({ error: 'Error al obtener solicitud' }, { status: 500 });
  }
}

async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'purchases', 'update')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.compraSolicitud.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    const isOwner = existing.solicitadoPorId === req.user!.userId;
    if (!isCompraEditable(existing.estado) || (!isOwner && role !== 'ADMIN')) {
      return NextResponse.json({ error: 'La solicitud no es editable' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = updateCompraSolicitudSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const solicitud = await updateCompraSolicitud(id, parsed.data);
    return NextResponse.json({ solicitud });
  } catch (error) {
    console.error('Error updating compra solicitud:', error);
    return NextResponse.json({ error: 'Error al actualizar solicitud' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
