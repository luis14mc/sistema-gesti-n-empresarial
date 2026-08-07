import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getCompraOrdenHtmlPreview, getCompraOrden } from '@/lib/compras/orden/service';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import type { Role } from '@/types';
import { requireOrganizationContext } from '@/modules/organizations/application/context';

export const GET = withAuth(async (req: AuthenticatedRequest, { params }) => {
  const role = req.user!.role as Role;
  const { organizationId } = await requireOrganizationContext(req);
  const { id } = await params;
  const orden = await getCompraOrden(id, organizationId);
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  if (!canOrdenAction(role, 'read', { isCreator: orden.createdById === req.user!.userId })) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  const html = await getCompraOrdenHtmlPreview(id, organizationId);
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
});
