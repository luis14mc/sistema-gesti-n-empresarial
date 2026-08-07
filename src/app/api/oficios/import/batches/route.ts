import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import type { Role } from '@/types';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { oficioOrganizationFailure } from '@/modules/oficios/presentation/http';
import { oficioBatchScope, oficioBatchTenantScope } from '@/modules/oficios/infrastructure/tenant-scope';

export const dynamic = 'force-dynamic';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await requireOrganizationContext(req, requestId);
    const role = req.user!.role as Role;
    if (!canAccess(role, 'oficios', 'read')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const batchId = searchParams.get('batchId');

    if (batchId) {
      const batch = await prisma.oficioImportBatch.findFirst({
        where: oficioBatchScope(organization.organizationId, batchId),
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
      where: oficioBatchTenantScope(organization.organizationId),
      take: limit,
      orderBy: { startedAt: 'desc' },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json({ batches });
  } catch (error) {
    const organizationResponse = oficioOrganizationFailure(error, requestId);
    if (organizationResponse) return organizationResponse;
    console.error('Error listando batches:', error);
    return NextResponse.json({ error: 'Error al listar batches' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
