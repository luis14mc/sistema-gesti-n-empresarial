import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { getCompraOrden, readPurchaseOrderDocumentFile } from '@/modules/purchases/application/purchase-order-use-cases';
import { buildAttachmentContentDisposition } from '@/modules/purchases/infrastructure/purchase-order-document-access';
import { canOrdenAction } from '@/modules/purchases/domain/purchase-order-permissions';
import { loadEffectivePermissions } from '@/modules/purchases/presentation/purchase-order-effective-permissions';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const GET = withAuth(async (req: AuthenticatedRequest, { params }) => {
  const org = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.download');
  const permissions = await loadEffectivePermissions(org);
  const { id, documentId } = await params;
  const orden = await getCompraOrden(id, org.organizationId);
  if (!orden) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  }
  if (
    !canOrdenAction(permissions, 'read', {
      membershipRole: org.role,
      sessionRole: req.user!.role,
      isCreator: orden.createdById === req.user!.userId,
      status: orden.status,
    })
  ) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  try {
    const document = await readPurchaseOrderDocumentFile(id, documentId, org.organizationId);
    return new NextResponse(new Uint8Array(document.buffer), {
      status: 200,
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': buildAttachmentContentDisposition(document.originalName),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 404 }
    );
  }
});
