import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import {
  createCompraOrden,
  listCompraOrdenes,
} from '@/modules/purchases/application/purchase-order-use-cases';
import {
  createCompraOrdenSchema,
  normalizePurchaseOrderPayload,
} from '@/modules/purchases/presentation/purchase-order-schemas';
import { canOrdenAction } from '@/modules/purchases/domain/purchase-order-permissions';
import { handlePrismaRouteError } from '@/modules/purchases/presentation/http';
import { parsePurchaseOrderListStatus } from '@/modules/purchases/domain/list-status-filter';
import type { Role } from '@/types';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const requestId = crypto.randomUUID();
    const role = req.user!.role as Role;
    const { organizationId } = await authorizeOrganization(req, requestId, 'purchase-orders.read');

    const { searchParams } = new URL(req.url);
    const mine = searchParams.get('mine') === 'true' || role === 'USER';

    const statusQuery = searchParams.get('status') || searchParams.get('estado') || undefined;
    const statusFilter = parsePurchaseOrderListStatus(statusQuery);

    const result = await listCompraOrdenes({
      organizationId,
      page: Number.parseInt(searchParams.get('page') || '1', 10),
      pageSize: Number.parseInt(searchParams.get('pageSize') || '10', 10),
      search: searchParams.get('search') || undefined,
      status: statusFilter.status,
      statusIn: statusFilter.statusIn,
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
    const requestId = crypto.randomUUID();
    const role = req.user!.role as Role;
    const { organizationId } = await authorizeOrganization(req, requestId, 'purchase-orders.create');
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
