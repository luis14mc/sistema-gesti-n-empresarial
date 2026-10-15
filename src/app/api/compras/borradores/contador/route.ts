import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { handlePrismaRouteError } from '@/lib/compras/orden/prisma-error';
import { purchaseOrderScope } from '@/lib/compras/orden/tenant';

export const dynamic = 'force-dynamic';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { organizationId } = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.read');
    const userId = req.user!.userId;

    const count = await prisma.compraOrden.count({
      where: {
        ...purchaseOrderScope(organizationId),
        deletedAt: null,
        status: 'DRAFT',
        createdById: userId,
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    return handlePrismaRouteError(error, 'GET /api/compras/borradores/contador');
  }
}

export const GET = withAuth(getHandler);
