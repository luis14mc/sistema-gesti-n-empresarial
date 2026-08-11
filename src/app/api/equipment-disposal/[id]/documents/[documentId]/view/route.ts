import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { runDisposalRoute } from '@/modules/equipment-disposal/presentation/http';
import { requirePermission } from '@/platform/security/authorization/permissions';
import { EquipmentDisposalError } from '@/modules/equipment-disposal/application/errors';
import { readStoredDocument, buildInlineContentDisposition } from '@/lib/compras/orden/document-access';
import { disposalDocumentScope } from '@/modules/equipment-disposal/infrastructure/tenant-scope';

async function handler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  return runDisposalRoute(request, 'documents.view', async ({ context, requestId }) => {
    requirePermission(context, 'equipment-disposal.read');
    const { id, documentId } = await params;
    const document = await prisma.disposalDocument.findFirst({ where: disposalDocumentScope(context.organizationId, id, documentId) });
    if (!document) throw new EquipmentDisposalError('DISPOSAL_DOCUMENT_NOT_FOUND', 404);
    const stored = await readStoredDocument(document.storageKey, document.mimeType);
    return new NextResponse(new Uint8Array(stored.buffer), { headers: { 'content-type': stored.mimeType, 'content-disposition': buildInlineContentDisposition(document.originalName), 'x-request-id': requestId, 'cache-control': 'private, no-store' } });
  });
}
export const GET = withAuth(handler);
