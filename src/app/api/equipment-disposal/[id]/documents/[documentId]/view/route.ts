import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { runDisposalRoute } from '@/modules/equipment-disposal/presentation/http';
import { requireOrganizationPermission } from '@/platform/security/authorization/effective-permissions';
import { disposalDocumentsService } from '@/modules/equipment-disposal/application/documents-service';
import { buildInlineContentDisposition } from '@/modules/purchases/infrastructure/purchase-order-document-access';

async function handler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  return runDisposalRoute(request, 'documents.view', async ({ context, requestId }) => {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'equipment-disposal.read');
    const { id, documentId } = await params;
    const { document, stored } = await disposalDocumentsService.read(context, id, documentId);
    return new NextResponse(new Uint8Array(stored.buffer), { headers: { 'content-type': stored.mimeType, 'content-disposition': buildInlineContentDisposition(document.originalName), 'x-request-id': requestId, 'cache-control': 'private, no-store' } });
  });
}
export const GET = withAuth(handler);
