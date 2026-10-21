import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getPurchaseReportsSummary } from '@/modules/purchases/application/purchase-reports';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { handlePurchaseOrderRouteError } from '@/modules/purchases/presentation/http';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { organizationId } = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.read');

    const { searchParams } = new URL(req.url);
    const year = Number.parseInt(searchParams.get('year') || `${new Date().getFullYear()}`, 10);

    const payload = await getPurchaseReportsSummary(organizationId, year);

    return NextResponse.json(payload);
  } catch (error) {
    return handlePurchaseOrderRouteError(error, 'GET /api/compras/reportes');
  }
}

export const GET = withAuth(getHandler);
