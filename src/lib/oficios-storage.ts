/**
 * Almacenamiento de documentos de Oficios.
 *
 * SPRINT 1: usa StorageAdapter (Local en dev, S3 en prod).
 * Antes: guardaba en public/uploads local. Ahora:
 *   - STORAGE_DRIVER=local (default): LocalStorageAdapter
 *   - STORAGE_DRIVER=s3:   S3StorageAdapter (Sprint 2)
 */

import type { OficioAttachment } from '@/types';
import { sanitizeOriginalName, validateOficioUploadFile } from '@/lib/oficios-attachments';
import { getStorage } from '@/lib/storage';

export interface SaveOficioDocumentResult extends OficioAttachment {
  /** Storage key (full path) returned by the StorageAdapter. */
  storageKey: string;
}

export async function saveOficioDocument(file: File, organizationId: string): Promise<SaveOficioDocumentResult> {
  const originalName = sanitizeOriginalName(file.name);
  const { extension, mimeType } = validateOficioUploadFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();

  const baseName = originalName.replace(/\.[^.]+$/, '');
  const desiredName = file.name.replace(/[^a-zA-Z0-9-_.]/g, '_').replace(/\s+/g, '_');

  const stored = await storage.put({
    prefix: `organizations/${organizationId}/oficios`,
    originalName: `${baseName}${extension}`,
    mimeType,
    size: file.size,
    buffer,
    desiredName,
  });

  return {
    url: stored.url,
    filename: stored.filename,
    originalName,
    mimeType,
    size: stored.size,
    uploadedAt: stored.uploadedAt,
    storageKey: stored.key,
  };
}
