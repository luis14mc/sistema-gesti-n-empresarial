import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { ORDEN_ESTADOS_PENDIENTES } from '@/lib/compras/orden/constants';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { handlePrismaRouteError } from '@/lib/compras/orden/prisma-error';

export const dynamic = 'force-dynamic';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { organizationId } = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.read');

    const count = await prisma.compraOrden.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: [...ORDEN_ESTADOS_PENDIENTES] },
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    return handlePrismaRouteError(error, 'GET /api/compras/bandeja/contador');
  }
}

export const GET = withAuth(getHandler);
