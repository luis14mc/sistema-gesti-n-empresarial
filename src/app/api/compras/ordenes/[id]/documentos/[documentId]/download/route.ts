import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getCompraOrden, readPurchaseOrderDocumentFile } from '@/lib/compras/orden/service';
import { buildAttachmentContentDisposition } from '@/lib/compras/orden/document-access';
import { canOrdenAction, ordenActionAuthFromContext } from '@/lib/compras/orden/permissions';
import type { Role } from '@/types';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const GET = withAuth(async (req: AuthenticatedRequest, { params }) => {
  const role = req.user!.role as Role;
  const org = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.download');
  const { id, documentId } = await params;
  const orden = await getCompraOrden(id, org.organizationId);
  if (!orden) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  }
  if (!(await canOrdenAction(role, 'read', { isCreator: orden.createdById === req.user!.userId, status: orden.status }, ordenActionAuthFromContext(org)))) {
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
