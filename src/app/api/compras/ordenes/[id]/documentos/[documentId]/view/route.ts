import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { getCompraOrden, readPurchaseOrderDocumentFile } from '@/lib/compras/orden/service';
import { buildInlineContentDisposition } from '@/lib/compras/orden/document-access';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import type { Role } from '@/types';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const GET = withAuth(async (req: AuthenticatedRequest, { params }) => {
  const requestId = crypto.randomUUID();
  const role = req.user!.role as Role;
  const { organizationId } = await authorizeOrganization(req, requestId, 'purchase-orders.download');
  const { id, documentId } = await params;
  const orden = await getCompraOrden(id, organizationId);
  if (!orden) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  }
  if (!canOrdenAction(role, 'read', { isCreator: orden.createdById === req.user!.userId, status: orden.status })) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  try {
    const document = await readPurchaseOrderDocumentFile(id, documentId, organizationId);
    const purpose = req.nextUrl.searchParams.get('purpose');
    if (purpose === 'print') {
      await createAuditRecord({
        title: 'Impresión de orden de compra',
        description: 'El usuario inició la impresión del PDF oficial de la orden.',
        module: 'COMPRAS',
        category: 'PURCHASE_ORDER',
        userId: req.user!.userId,
        organizationId,
        entityId: id,
        entityType: 'CompraOrden',
        action: 'PURCHASE_ORDER_PRINTED',
        requestId,
        metadata: { documentId, documentType: 'ORDER_PDF' },
      });
    }
    return new NextResponse(new Uint8Array(document.buffer), {
      status: 200,
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': buildInlineContentDisposition(document.originalName),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 404 }
    );
  }
});
