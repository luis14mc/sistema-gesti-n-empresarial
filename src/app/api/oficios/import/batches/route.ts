import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import type { Role } from '@/types';

export const dynamic = 'force-dynamic';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'oficios', 'read')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const batchId = searchParams.get('batchId');

    if (batchId) {
      const batch = await prisma.oficioImportBatch.findUnique({
        where: { id: batchId },
        include: {
          performedBy: { select: { id: true, firstName: true, lastName: true } },
          items: { orderBy: { rowIndex: 'asc' } },
        },
      });
      if (!batch) {
        return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ batch });
    }

    const batches = await prisma.oficioImportBatch.findMany({
      take: limit,
      orderBy: { startedAt: 'desc' },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json({ batches });
  } catch (error) {
    console.error('Error listando batches:', error);
    return NextResponse.json({ error: 'Error al listar batches' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
