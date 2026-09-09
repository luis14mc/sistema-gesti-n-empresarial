import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { handlePrismaRouteError } from '@/lib/compras/orden/prisma-error';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { organizationId } = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.read');

    const centros = await prisma.costCenter.findMany({
      where: { organizationId, isActive: true },
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({ centros });
  } catch (error) {
    return handlePrismaRouteError(error, 'GET /api/compras/centros-costo');
  }
}

export const GET = withAuth(getHandler);
