import { createHash } from 'crypto';
import { createAuditRecord } from '@/lib/audit';
import { OficioBadRequestError, OficioNotFoundError } from '@/modules/oficios/domain/errors';
import {
  clearPrimaryOficioDocuments,
  createOficioDocument,
  createOficioTrackingEntry,
  findOficioIdOnly,
} from '@/modules/oficios/infrastructure/oficio-repository';
import { saveOficioDocument } from '@/modules/oficios/infrastructure/oficios-storage';

export async function attachDocumentsUseCase(params: {
  organizationId: string;
  actorUserId: string;
  oficioId: string;
  file: File;
  documentType: string;
  isPrimary: boolean;
}) {
  const oficio = await findOficioIdOnly(params.organizationId, params.oficioId);
  if (!oficio) {
    throw new OficioNotFoundError();
  }

  const stored = await saveOficioDocument(params.file, params.organizationId);
  const fileHash =
    stored.fileHash ??
    createHash('sha256').update(Buffer.from(await params.file.arrayBuffer())).digest('hex');

  const document = await createOficioDocument({
    organizationId: params.organizationId,
    oficioId: params.oficioId,
    data: {
      filename: stored.filename,
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      size: stored.size,
      originalSizeBytes: stored.originalSizeBytes ?? null,
      storedSizeBytes: stored.storedSizeBytes ?? stored.size,
      optimized: stored.optimized ?? false,
      signedPdf: stored.signedPdf ?? false,
      storageKey: stored.storageKey,
      url: stored.url,
      fileHash,
      documentType: params.documentType,
      isPrimary: params.isPrimary,
      uploadedById: params.actorUserId,
    },
  });

  if (params.isPrimary) {
    await clearPrimaryOficioDocuments(
      params.organizationId,
      params.oficioId,
      document.id,
    );
  }

  await createOficioTrackingEntry({
    oficioId: params.oficioId,
    action: 'DOCUMENT_ADDED',
    title: 'Documento agregado',
    description: `${params.documentType} — ${stored.originalName}`,
    performedById: params.actorUserId,
    newData: { documentId: document.id, documentType: params.documentType, fileHash },
  });

  await createAuditRecord({
    title: 'Documento agregado a oficio',
    description: `Se agregó documento ${stored.originalName} al oficio ${params.oficioId}`,
    module: 'OFICIOS',
    category: 'CREATE',
    userId: params.actorUserId,
    entityId: params.oficioId,
    organizationId: params.organizationId,
    newData: { documentId: document.id, documentType: params.documentType },
  });

  return {
    document,
    pdfOptimizationSummary: stored.pdfOptimizationSummary ?? null,
    status: 201 as const,
  };
}

export function assertAttachDocumentFile(file: unknown): asserts file is File {
  if (!(file instanceof File)) {
    throw new OficioBadRequestError('Archivo requerido');
  }
}
