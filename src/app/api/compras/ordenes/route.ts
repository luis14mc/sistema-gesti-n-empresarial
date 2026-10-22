import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import {
  createCompraOrden,
  listCompraOrdenes,
} from '@/modules/purchases/application/purchase-order-use-cases';
import {
  createCompraOrdenSchema,
  normalizePurchaseOrderPayload,
} from '@/modules/purchases/presentation/purchase-order-schemas';
import {
  canOrdenAction,
  shouldScopePurchaseOrdersToMine,
} from '@/modules/purchases/domain/purchase-order-permissions';
import { loadEffectivePermissions } from '@/modules/purchases/presentation/purchase-order-effective-permissions';
import { handlePrismaRouteError } from '@/modules/purchases/presentation/http';
import { parsePurchaseOrderListStatus } from '@/modules/purchases/domain/list-status-filter';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const requestId = crypto.randomUUID();
    const org = await authorizeOrganization(req, requestId, 'purchase-orders.read');
    const permissions = await loadEffectivePermissions(org);

    const { searchParams } = new URL(req.url);
    const mine =
      searchParams.get('mine') === 'true' || shouldScopePurchaseOrdersToMine(permissions, org.role);

    const statusQuery = searchParams.get('status') || searchParams.get('estado') || undefined;
    const statusFilter = parsePurchaseOrderListStatus(statusQuery);

    const result = await listCompraOrdenes({
      organizationId: org.organizationId,
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
    const org = await authorizeOrganization(req, requestId, 'purchase-orders.create');
    const permissions = await loadEffectivePermissions(org);
    if (!canOrdenAction(permissions, 'create')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createCompraOrdenSchema.safeParse(normalizePurchaseOrderPayload(body));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const orden = await createCompraOrden(parsed.data, req.user!.userId, org.organizationId);
    return NextResponse.json({ orden }, { status: 201 });
  } catch (error) {
    return handlePrismaRouteError(error, 'POST /api/compras/ordenes');
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
