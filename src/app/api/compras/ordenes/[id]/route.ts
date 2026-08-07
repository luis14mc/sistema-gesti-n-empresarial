import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import {
  getCompraOrden,
  updateCompraOrden,
  deleteCompraOrden,
} from '@/lib/compras/orden/service';
import { updateCompraOrdenSchema, normalizePurchaseOrderPayload } from '@/lib/compras/orden/schemas';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import { handlePrismaRouteError } from '@/lib/compras/orden/prisma-error';
import type { Role } from '@/types';
import { requireOrganizationContext } from '@/modules/organizations/application/context';

async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = req.user!.role as Role;
    const { organizationId } = await requireOrganizationContext(req);
    const { id } = await params;
    const orden = await getCompraOrden(id, organizationId);
    if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

    if (
      !canOrdenAction(role, 'read', {
        isCreator: orden.createdById === req.user!.userId,
      })
    ) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    return NextResponse.json({ orden });
  } catch (error) {
    return handlePrismaRouteError(error, 'GET /api/compras/ordenes/[id]');
  }
}

async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = req.user!.role as Role;
    const { organizationId } = await requireOrganizationContext(req);
    const { id } = await params;
    const existing = await getCompraOrden(id, organizationId);
    if (!existing) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

    if (
      !canOrdenAction(role, 'update', {
        isCreator: existing.createdById === req.user!.userId,
        status: existing.status,
      })
    ) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateCompraOrdenSchema.safeParse(normalizePurchaseOrderPayload(body));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const orden = await updateCompraOrden(id, parsed.data, req.user!.userId, organizationId);
    return NextResponse.json({ orden });
  } catch (error) {
    if (error instanceof Error && !('code' in error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handlePrismaRouteError(error, 'PATCH /api/compras/ordenes/[id]');
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);

async function deleteHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = req.user!.role as Role;
    const { organizationId } = await requireOrganizationContext(req);
    const { id } = await params;
    const existing = await getCompraOrden(id, organizationId);
    if (!existing) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

    if (
      !canOrdenAction(role, 'delete', {
        isCreator: existing.createdById === req.user!.userId,
        status: existing.status,
      })
    ) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    await deleteCompraOrden(id, req.user!.userId, organizationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'ORDER_NOT_FOUND') {
      return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'ONLY_DRAFT_CAN_BE_DELETED') {
      return NextResponse.json(
        { error: 'ONLY_DRAFT_CAN_BE_DELETED', message: 'Solo se pueden eliminar borradores.' },
        { status: 409 }
      );
    }
    return handlePrismaRouteError(error, 'DELETE /api/compras/ordenes/[id]');
  }
}

export const DELETE = withAuth(deleteHandler);
