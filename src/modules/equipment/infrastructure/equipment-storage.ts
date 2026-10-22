/**
 * Almacenamiento de documentos de Equipos TI.
 * Usa StorageAdapter (Local en dev, S3 en prod).
 */

import { sanitizeOriginalName, validateEquipmentUploadFile } from '@/modules/equipment/infrastructure/equipment-attachments';
import {
  equipmentDocumentStoragePrefix,
  resolveEquipmentDocumentType,
  type EquipmentDocumentType,
} from '@/modules/equipment/domain/equipment-document-types';
import { getStorage } from '@/platform/storage';
import { equipmentDocumentFileUrl } from '@/modules/equipment/infrastructure/equipment-document-access';

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
    // Rutas locales (/uploads/...) se sirven estáticas; en S3/R2 la URL firmada
    // vence, así que se expone una ruta estable que resuelve la clave al abrir.
    url: stored.url.startsWith('/') ? stored.url : equipmentDocumentFileUrl(stored.key),
    filename: stored.filename,
    originalName,
    mimeType,
    size: stored.size,
    uploadedAt: stored.uploadedAt,
    storageKey: stored.key,
  };
}
