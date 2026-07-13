/**
 * Almacenamiento de documentos de Equipos TI.
 * SPRINT 1: usa StorageAdapter (Local en dev, S3 en prod).
 */

import { sanitizeOriginalName, validateEquipmentUploadFile } from '@/lib/equipment-attachments';
import { getStorage } from '@/lib/storage';

export interface EquipmentDocumentMeta {
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export async function saveEquipmentDocument(
  file: File,
  subfolder: 'assignments' | 'returns' | 'maintenance' | 'general' = 'general'
): Promise<EquipmentDocumentMeta> {
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
    prefix: `equipment/${subfolder}`,
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
  };
}
