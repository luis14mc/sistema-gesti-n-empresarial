import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { ORDEN_ESTADOS_PENDIENTES } from '@/lib/compras/orden/constants';
import type { Role } from '@/types';

export const dynamic = 'force-dynamic';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'purchases', 'read')) {
      return NextResponse.json({ count: 0 });
    }

    const count = await prisma.compraOrden.count({
      where: {
        deletedAt: null,
        status: { in: [...ORDEN_ESTADOS_PENDIENTES] },
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error contando solicitudes pendientes:', error);
    return NextResponse.json({ count: 0 });
  }
}

export const GET = withAuth(getHandler);
