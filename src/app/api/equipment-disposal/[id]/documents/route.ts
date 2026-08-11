import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { apiSuccess } from '@/platform/api/response';
import { runDisposalRoute } from '@/modules/equipment-disposal/presentation/http';
import { requirePermission } from '@/platform/security/authorization/permissions';
import { EquipmentDisposalError } from '@/modules/equipment-disposal/application/errors';
import { storeDisposalDocument } from '@/modules/equipment-disposal/infrastructure/documents';
import { removeStoredDocument } from '@/lib/compras/orden/document-access';

async function getHandler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  return runDisposalRoute(request, 'documents.list', async ({ context, requestId }) => {
    requirePermission(context, 'equipment-disposal.read');
    const { id } = await params;
    const disposal = await prisma.equipmentDisposal.findFirst({ where: { id, organizationId: context.organizationId }, select: { id: true } });
    if (!disposal) throw new EquipmentDisposalError('DISPOSAL_NOT_FOUND', 404);
    const documents = await prisma.disposalDocument.findMany({ where: { disposalId: id, organizationId: context.organizationId }, orderBy: { createdAt: 'desc' } });
    return apiSuccess(documents, { requestId });
  });
}

async function postHandler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  return runDisposalRoute(request, 'documents.upload', async ({ context, requestId }) => {
    requirePermission(context, 'equipment-disposal.update');
    const { id } = await params;
    const disposal = await prisma.equipmentDisposal.findFirst({ where: { id, organizationId: context.organizationId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } }, select: { id: true } });
    if (!disposal) throw new EquipmentDisposalError('DISPOSAL_NOT_EDITABLE', 409);
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) throw new EquipmentDisposalError('INVALID_DISPOSAL_DOCUMENT', 400);
    const { stored, hash } = await storeDisposalDocument({ organizationId: context.organizationId, disposalId: id, file });
    try {
      const document = await prisma.$transaction(async (tx) => {
        const duplicate = await tx.disposalDocument.findFirst({ where: { organizationId: context.organizationId, disposalId: id, fileHash: hash } });
        if (duplicate) throw new EquipmentDisposalError('DUPLICATE_DISPOSAL_DOCUMENT', 409);
        const created = await tx.disposalDocument.create({ data: { organizationId: context.organizationId, disposalId: id, storageKey: stored.key, fileName: stored.filename, originalName: file.name, mimeType: file.type, fileSize: file.size, fileHash: hash, uploadedById: context.userId } });
        await tx.equipmentDisposalHistory.create({ data: { organizationId: context.organizationId, disposalId: id, action: 'DISPOSAL_DOCUMENT_UPLOADED', performedById: context.userId, requestId, newValues: { documentId: created.id, fileName: created.fileName } } });
        return created;
      });
      return apiSuccess(document, { requestId, status: 201 });
    } catch (error) {
      await removeStoredDocument(stored.key).catch(() => undefined);
      throw error;
    }
  });
}
export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
