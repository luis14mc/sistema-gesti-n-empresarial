import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { getCompraOrdenHtmlPreview, getCompraOrden } from '@/modules/purchases/application/purchase-order-use-cases';
import { canOrdenAction } from '@/modules/purchases/domain/purchase-order-permissions';
import { loadEffectivePermissions } from '@/modules/purchases/presentation/purchase-order-effective-permissions';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const GET = withAuth(async (req: AuthenticatedRequest, { params }) => {
  const org = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.download');
  const permissions = await loadEffectivePermissions(org);
  const { id } = await params;
  const orden = await getCompraOrden(id, org.organizationId);
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  if (!canOrdenAction(permissions, 'read', { isCreator: orden.createdById === req.user!.userId })) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  const html = await getCompraOrdenHtmlPreview(id, org.organizationId);
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
});
