import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import {
  createCompraOrden,
  listCompraOrdenes,
} from '@/lib/compras/orden/service';
import { createCompraOrdenSchema, normalizePurchaseOrderPayload } from '@/lib/compras/orden/schemas';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import { handlePrismaRouteError, mapLegacyEstadoFilter } from '@/lib/compras/orden/prisma-error';
import type { Role } from '@/types';
import { requireOrganizationContext } from '@/modules/organizations/application/context';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    const { organizationId } = await requireOrganizationContext(req);
    if (!canAccess(role, 'purchases', 'read')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const mine = searchParams.get('mine') === 'true' || role === 'USER';

    const result = await listCompraOrdenes({
      organizationId,
      page: Number.parseInt(searchParams.get('page') || '1', 10),
      pageSize: Number.parseInt(searchParams.get('pageSize') || '10', 10),
      search: searchParams.get('search') || undefined,
      status: mapLegacyEstadoFilter(
        searchParams.get('status') || searchParams.get('estado') || undefined
      ),
      mine,
      userId: req.user!.userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handlePrismaRouteError(error, 'GET /api/compras/ordenes');
  }
}

async function postHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    const { organizationId } = await requireOrganizationContext(req);
    if (!canOrdenAction(role, 'create')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createCompraOrdenSchema.safeParse(normalizePurchaseOrderPayload(body));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const orden = await createCompraOrden(parsed.data, req.user!.userId, organizationId);
    return NextResponse.json({ orden }, { status: 201 });
  } catch (error) {
    return handlePrismaRouteError(error, 'POST /api/compras/ordenes');
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
