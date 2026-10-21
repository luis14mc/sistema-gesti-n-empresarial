import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { runDisposalRoute } from '@/modules/equipment-disposal/presentation/http';
import { requireOrganizationPermission } from '@/platform/security/authorization/effective-permissions';
import { disposalDocumentsService } from '@/modules/equipment-disposal/application/documents-service';
import { buildAttachmentContentDisposition } from '@/modules/purchases/infrastructure/purchase-order-document-access';

async function handler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  return runDisposalRoute(request, 'pdf.download', async ({ context, requestId }) => {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'equipment-disposal.download');
    const { id } = await params;
    const { folio, stored } = await disposalDocumentsService.readApprovedPdf(context, id);
    return new NextResponse(new Uint8Array(stored.buffer), { headers: { 'content-type': 'application/pdf', 'content-disposition': buildAttachmentContentDisposition(`${folio}.pdf`), 'x-request-id': requestId, 'cache-control': 'private, no-store' } });
  });
}
export const GET = withAuth(handler);
