import type { OrganizationContext } from '@/modules/organizations/application/context';
import { EquipmentDisposalError } from './errors';
import {
  deleteDisposalDocumentRecord,
  findApprovedDisposalPdf,
  findDisposalDocument,
  findDisposalId,
  findDraftDisposalDocument,
  findEditableDisposalId,
  insertDisposalDocument,
  listDisposalDocuments,
} from '../infrastructure/repository';
import { storeDisposalDocument } from '../infrastructure/documents';
import { readStoredDocument, removeStoredDocument } from '@/modules/purchases/infrastructure/purchase-order-document-access';

/** Las rutas verifican el permiso con requireOrganizationPermission antes de invocar cada caso de uso. */
export const disposalDocumentsService = {
  async list(context: OrganizationContext, id: string) {
    const disposal = await findDisposalId(context.organizationId, id);
    if (!disposal) throw new EquipmentDisposalError('DISPOSAL_NOT_FOUND', 404);
    return listDisposalDocuments(context.organizationId, id);
  },

  async assertUploadAllowed(context: OrganizationContext, id: string) {
    const disposal = await findEditableDisposalId(context.organizationId, id);
    if (!disposal) throw new EquipmentDisposalError('DISPOSAL_NOT_EDITABLE', 409);
  },

  async upload(context: OrganizationContext, id: string, file: unknown, requestId: string) {
    if (!(file instanceof File)) throw new EquipmentDisposalError('INVALID_DISPOSAL_DOCUMENT', 400);
    const { stored, hash, originalSizeBytes, storedSizeBytes, optimized, signedPdf } = await storeDisposalDocument({ organizationId: context.organizationId, disposalId: id, file });
    try {
      return await insertDisposalDocument(
        {
          organizationId: context.organizationId,
          disposalId: id,
          userId: context.userId,
          requestId,
          data: { storageKey: stored.key, fileName: stored.filename, originalName: file.name, mimeType: file.type, fileSize: stored.size, originalSizeBytes: originalSizeBytes ?? null, storedSizeBytes: storedSizeBytes ?? stored.size, optimized: optimized ?? false, signedPdf: signedPdf ?? false, fileHash: hash },
        },
        () => { throw new EquipmentDisposalError('DUPLICATE_DISPOSAL_DOCUMENT', 409); },
      );
    } catch (error) {
      await removeStoredDocument(stored.key).catch(() => undefined);
      throw error;
    }
  },

  async remove(context: OrganizationContext, id: string, documentId: string, requestId: string) {
    const document = await findDraftDisposalDocument(context.organizationId, id, documentId);
    if (!document) throw new EquipmentDisposalError('DISPOSAL_DOCUMENT_NOT_FOUND', 404);
    await deleteDisposalDocumentRecord({
      organizationId: context.organizationId,
      disposalId: id,
      userId: context.userId,
      requestId,
      document,
      documentId,
    });
    await removeStoredDocument(document.storageKey).catch((error) => {
      console.error('[DISPOSAL] Failed to remove stored document after DB delete', {
        documentId,
        storageKey: document.storageKey,
        error,
      });
    });
  },

  async read(context: OrganizationContext, id: string, documentId: string) {
    const document = await findDisposalDocument(context.organizationId, id, documentId);
    if (!document) throw new EquipmentDisposalError('DISPOSAL_DOCUMENT_NOT_FOUND', 404);
    const stored = await readStoredDocument(document.storageKey, document.mimeType);
    return { document, stored };
  },

  async readApprovedPdf(context: OrganizationContext, id: string) {
    const disposal = await findApprovedDisposalPdf(context.organizationId, id);
    if (!disposal?.pdfStorageKey) throw new EquipmentDisposalError('DISPOSAL_PDF_NOT_FOUND', 404);
    const stored = await readStoredDocument(disposal.pdfStorageKey, 'application/pdf');
    return { folio: disposal.folio, stored };
  },
};
