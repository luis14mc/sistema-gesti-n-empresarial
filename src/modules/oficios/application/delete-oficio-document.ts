import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { OficioNotFoundError } from '@/modules/oficios/domain/errors';
import { deleteOficioDocumentRecord } from '@/modules/oficios/infrastructure/oficio-repository';
import { removeStoredDocument } from '@/modules/purchases/infrastructure/purchase-order-document-access';

export async function deleteOficioDocumentUseCase(params: {
  organizationId: string;
  actorUserId: string;
  oficioId: string;
  documentId: string;
}) {
  const deleted = await deleteOficioDocumentRecord({
    organizationId: params.organizationId,
    oficioId: params.oficioId,
    documentId: params.documentId,
    actorUserId: params.actorUserId,
  });

  if (!deleted) {
    throw new OficioNotFoundError();
  }

  await createAuditRecord({
    title: 'Documento eliminado de oficio',
    description: `Se eliminó ${deleted.originalName} del oficio ${params.oficioId}`,
    module: 'OFICIOS',
    category: 'DELETE',
    userId: params.actorUserId,
    entityId: params.oficioId,
    organizationId: params.organizationId,
    previousData: { documentId: deleted.id, storageKey: deleted.storageKey },
  });

  await removeStoredDocument(deleted.storageKey).catch((error) => {
    console.error('[OFICIOS] Failed to remove stored document after DB delete', {
      documentId: deleted.id,
      storageKey: deleted.storageKey,
      error,
    });
  });

  return { message: 'Documento eliminado' };
}
