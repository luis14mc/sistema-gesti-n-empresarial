/**
 * Almacenamiento de documentos de Equipos TI.
 * Usa StorageAdapter (Local en dev, S3 en prod).
 */

import { sanitizeOriginalName, validateEquipmentUploadFile } from '@/lib/equipment-attachments';
import {
  equipmentDocumentStoragePrefix,
  resolveEquipmentDocumentType,
  type EquipmentDocumentType,
} from '@/lib/equipment-document-types';
import { getStorage } from '@/lib/storage';

export interface EquipmentDocumentMeta {
  tipoDocumento: EquipmentDocumentType;
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  storageKey: string;
}

export async function saveEquipmentDocument(
  file: File,
  options: {
    organizationId: string;
    tipoDocumento?: string | null;
    subfolder?: string | null;
  }
): Promise<EquipmentDocumentMeta> {
  const tipoDocumento = resolveEquipmentDocumentType(options);
  const originalName = sanitizeOriginalName(file.name);
  const { extension, mimeType } = validateEquipmentUploadFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();

  const baseName = originalName.replace(/\.[^.]+$/, '');
  const desiredName = file.name.replace(/[^a-zA-Z0-9-_.]/g, '_').replace(/\s+/g, '_');

  const stored = await storage.put({
    prefix: `organizations/${options.organizationId}/${equipmentDocumentStoragePrefix(tipoDocumento)}`,
    originalName: `${baseName}${extension}`,
    mimeType,
    size: file.size,
    buffer,
    desiredName,
  });

  return {
    tipoDocumento,
    url: stored.url,
    filename: stored.filename,
    originalName,
    mimeType,
    size: stored.size,
    uploadedAt: stored.uploadedAt,
    storageKey: stored.key,
  };
}
