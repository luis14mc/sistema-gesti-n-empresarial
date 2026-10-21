import { createHash } from 'crypto';
import { ImportBatchDocumentsNotFoundError } from '@/modules/oficios/domain/errors';
import {
  clearPrimaryDocumentsExcept,
  createOficioDocumentRecord,
  findImportBatchForDocuments,
} from '@/modules/oficios/infrastructure/oficio-import-repository';
import { saveOficioDocument } from '@/modules/oficios/infrastructure/oficios-storage';

function normalizeMatchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function numberFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').trim();
}

export async function attachBatchDocumentsUseCase(params: {
  organizationId: string;
  actorUserId: string;
  batchId: string;
  files: File[];
  manualAssignments: Array<{ fileName: string; oficioId: string }>;
}) {
  const batch = await findImportBatchForDocuments(params.organizationId, params.batchId);
  if (!batch) {
    throw new ImportBatchDocumentsNotFoundError();
  }

  const byNumber = new Map<string, string>();
  for (const item of batch.items) {
    if (item.number && item.oficioId) {
      byNumber.set(normalizeMatchKey(item.number), item.oficioId);
    }
  }

  const matched: Array<{ fileName: string; oficioId: string; documentId: string }> = [];
  const unmatched: string[] = [];

  for (const file of params.files) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      unmatched.push(file.name);
      continue;
    }

    const manual = params.manualAssignments.find((entry) => entry.fileName === file.name);
    const inferredNumber = numberFromFilename(file.name);
    const oficioId =
      manual?.oficioId ??
      byNumber.get(normalizeMatchKey(inferredNumber)) ??
      byNumber.get(normalizeMatchKey(inferredNumber.replace(/_/g, ' ')));

    if (!oficioId) {
      unmatched.push(file.name);
      continue;
    }

    const stored = await saveOficioDocument(file, params.organizationId);
    const fileHash =
      stored.fileHash ??
      createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');

    const document = await createOficioDocumentRecord({
      oficioId,
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
      documentType: 'OFICIO_PRINCIPAL',
      isPrimary: true,
      uploadedById: params.actorUserId,
    });

    await clearPrimaryDocumentsExcept(oficioId, document.id);

    matched.push({ fileName: file.name, oficioId, documentId: document.id });
  }

  return { matched, unmatched };
}
