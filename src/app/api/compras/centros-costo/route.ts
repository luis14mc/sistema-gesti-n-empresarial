import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { listActiveCostCenters } from '@/modules/purchases/application/cost-centers';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { handlePurchaseOrderRouteError } from '@/modules/purchases/presentation/http';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { organizationId } = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.read');

    const centros = await listActiveCostCenters(organizationId);

    return NextResponse.json({ centros });
  } catch (error) {
    return handlePurchaseOrderRouteError(error, 'GET /api/compras/centros-costo');
  }
}

export const GET = withAuth(getHandler);
