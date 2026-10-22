/**
 * Almacenamiento de documentos de Oficios.
 *
 * SPRINT 1: usa StorageAdapter (Local en dev, S3 en prod).
 * Antes: guardaba en public/uploads local. Ahora:
 *   - STORAGE_DRIVER=local (default): LocalStorageAdapter
 *   - STORAGE_DRIVER=s3:   S3StorageAdapter (Sprint 2)
 */

import { createHash } from 'crypto';
import type { OficioAttachment } from '@/types';
import { sanitizeOriginalName, validateOficioUploadFile } from '@/modules/oficios/infrastructure/oficios-attachments';
import { getStorage } from '@/platform/storage';
import { prepareUploadBuffer } from '@/platform/storage/prepare-upload-buffer';

export interface SaveOficioDocumentResult extends OficioAttachment {
  /** Storage key (full path) returned by the StorageAdapter. */
  storageKey: string;
  originalSizeBytes?: number;
  storedSizeBytes?: number;
  optimized?: boolean;
  signedPdf?: boolean;
  pdfOptimizationSummary?: string;
  fileHash?: string;
}

export async function saveOficioDocument(file: File, organizationId: string): Promise<SaveOficioDocumentResult> {
  const originalName = sanitizeOriginalName(file.name);
  const { extension, mimeType } = validateOficioUploadFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const prepared = await prepareUploadBuffer(rawBuffer, mimeType);
  const buffer = prepared.buffer;
  const storage = getStorage();

  const baseName = originalName.replace(/\.[^.]+$/, '');
  const desiredName = file.name.replace(/[^a-zA-Z0-9-_.]/g, '_').replace(/\s+/g, '_');

  const stored = await storage.put({
    prefix: `organizations/${organizationId}/oficios`,
    originalName: `${baseName}${extension}`,
    mimeType,
    size: prepared.size,
    buffer,
    desiredName,
  });

  const fileHash = createHash('sha256').update(buffer).digest('hex');

  return {
    url: stored.url,
    filename: stored.filename,
    originalName,
    mimeType,
    size: stored.size,
    uploadedAt: stored.uploadedAt,
    storageKey: stored.key,
    originalSizeBytes: prepared.originalSizeBytes,
    storedSizeBytes: prepared.storedSizeBytes ?? stored.size,
    optimized: prepared.optimized,
    signedPdf: prepared.signedPdf,
    pdfOptimizationSummary: prepared.pdfOptimizationSummary,
    fileHash,
  };
}
