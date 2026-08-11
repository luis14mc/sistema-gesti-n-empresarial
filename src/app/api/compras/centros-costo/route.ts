import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import type { Role } from '@/types';
import { requireOrganizationContext } from '@/modules/organizations/application/context';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    const { organizationId } = await requireOrganizationContext(req);
    if (!canAccess(role, 'purchases', 'read')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const centros = await prisma.costCenter.findMany({
      where: { organizationId, isActive: true },
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({ centros });
  } catch (error) {
    console.error('Error listing cost centers:', error);
    return NextResponse.json({ error: 'Error al listar centros de costo' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
