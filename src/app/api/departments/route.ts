import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { handlePrismaRouteError } from '@/lib/compras/orden/prisma-error';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { organizationId } = await authorizeOrganization(req, crypto.randomUUID(), 'employees.read');
    const departments = await prisma.department.findMany({
      where: { organizationId, isActive: true },
      include: {
        positions: {
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ departments });
  } catch (error) {
    return handlePrismaRouteError(error, 'GET /api/departments');
  }
}

export const GET = withAuth(getHandler);
