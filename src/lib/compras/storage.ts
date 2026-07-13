import { getStorage } from '@/lib/storage';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const MAX_SIZE = 10 * 1024 * 1024;

export function validateCompraUploadFile(file: { name: string; type: string; size: number }) {
  if (file.size > MAX_SIZE) {
    throw new Error('El archivo excede el tamaño máximo de 10 MB');
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('Tipo de archivo no permitido');
  }
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  return { extension, mimeType: file.type };
}

export async function saveCompraDocument(file: File) {
  const originalName = file.name.replace(/[^a-zA-Z0-9-_.\s]/g, '_');
  const { mimeType } = validateCompraUploadFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  const stored = await storage.put({
    prefix: 'compras',
    originalName,
    mimeType,
    size: file.size,
    buffer,
    desiredName: originalName.replace(/\s+/g, '_'),
  });

  return {
    nombre: originalName,
    mimeType,
    size: stored.size,
    storagePath: stored.key,
    url: stored.url,
  };
}
