import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { countInboxPurchaseOrders } from '@/modules/purchases/application/purchase-counters';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { handlePurchaseOrderRouteError } from '@/modules/purchases/presentation/http';

export const dynamic = 'force-dynamic';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { organizationId } = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.read');

    const count = await countInboxPurchaseOrders(organizationId);

    return NextResponse.json({ count });
  } catch (error) {
    return handlePurchaseOrderRouteError(error, 'GET /api/compras/bandeja/contador');
  }
}

export const GET = withAuth(getHandler);
