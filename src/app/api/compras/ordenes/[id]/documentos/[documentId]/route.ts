import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { deletePurchaseOrderDocument, getCompraOrden } from '@/modules/purchases/application/purchase-order-use-cases';
import { canOrdenAction } from '@/modules/purchases/domain/purchase-order-permissions';
import { loadEffectivePermissions } from '@/modules/purchases/presentation/purchase-order-effective-permissions';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const DELETE = withAuth(async (req: AuthenticatedRequest, { params }) => {
  const org = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.update');
  const permissions = await loadEffectivePermissions(org);
  const { id, documentId } = await params;
  const orden = await getCompraOrden(id, org.organizationId);
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  if (
    !canOrdenAction(permissions, 'documentos', {
      membershipRole: org.role,
      sessionRole: req.user!.role,
      isCreator: orden.createdById === req.user!.userId,
    })
  ) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  try {
    await deletePurchaseOrderDocument(id, documentId, req.user!.userId, org.organizationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
});
