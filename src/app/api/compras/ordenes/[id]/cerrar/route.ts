import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { cerrarCompraOrden, getCompraOrden } from '@/lib/compras/orden/service';
import { canOrdenAction, ordenActionAuthFromContext } from '@/lib/compras/orden/permissions';
import type { Role } from '@/types';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const POST = withAuth(async (req: AuthenticatedRequest, { params }) => {
  const role = req.user!.role as Role;
  const org = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.update');
  const { id } = await params;
  const existing = await getCompraOrden(id, org.organizationId);
  if (!existing) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  if (!(await canOrdenAction(role, 'cerrar', { status: existing.status }, ordenActionAuthFromContext(org)))) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  try {
    const orden = await cerrarCompraOrden(id, req.user!.userId, org.organizationId);
    return NextResponse.json({ orden });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
});
