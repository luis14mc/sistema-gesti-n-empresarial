import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { apiSuccess } from '@/platform/api/response';
import { runDisposalRoute } from '@/modules/equipment-disposal/presentation/http';
import { requirePermission } from '@/modules/equipment-disposal/application/permissions';
import { EquipmentDisposalError } from '@/modules/equipment-disposal/application/errors';
import { removeStoredDocument } from '@/lib/compras/orden/document-access';
import { disposalDocumentScope } from '@/modules/equipment-disposal/infrastructure/tenant-scope';

async function handler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  return runDisposalRoute(request, 'documents.delete', async ({ context, requestId }) => {
    requirePermission(context.role, 'equipment-disposal.update');
    const { id, documentId } = await params;
    const document = await prisma.disposalDocument.findFirst({ where: { ...disposalDocumentScope(context.organizationId, id, documentId), disposal: { status: 'DRAFT' } } });
    if (!document) throw new EquipmentDisposalError('DISPOSAL_DOCUMENT_NOT_FOUND', 404);
    await prisma.$transaction(async (tx) => {
      await tx.disposalDocument.delete({ where: { id: document.id } });
      await tx.equipmentDisposalHistory.create({ data: { organizationId: context.organizationId, disposalId: id, action: 'DISPOSAL_DOCUMENT_DELETED', performedById: context.userId, requestId, previousValues: { documentId, fileName: document.fileName } } });
    });
    await removeStoredDocument(document.storageKey);
    return apiSuccess({ deleted: true }, { requestId });
  });
}
export const DELETE = withAuth(handler);
