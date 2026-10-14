import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getCompraOrden, getCompraOrdenHistorial } from '@/lib/compras/orden/service';
import { canOrdenAction, ordenActionAuthFromContext } from '@/lib/compras/orden/permissions';
import type { Role } from '@/types';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const GET = withAuth(async (req: AuthenticatedRequest, { params }) => {
  const role = req.user!.role as Role;
  const org = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.read');
  const { id } = await params;
  const orden = await getCompraOrden(id, org.organizationId);
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  if (!(await canOrdenAction(role, 'historial', { isCreator: orden.createdById === req.user!.userId }, ordenActionAuthFromContext(org)))) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  const historial = await getCompraOrdenHistorial(id, org.organizationId);
  return NextResponse.json({ historial });
});
