import { createHash } from 'crypto';
import { getStorage } from '@/lib/storage';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const MAX_SIZE = 10 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

export function validateOrdenDocumentUpload(file: { name: string; type: string; size: number }) {
  if (file.size > MAX_SIZE) throw new Error('El archivo excede el tamaño máximo de 10 MB');
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
  const mimeType = ALLOWED_MIME.has(file.type) ? file.type : MIME_BY_EXTENSION[ext];
  if (!mimeType) throw new Error('Tipo de archivo no permitido (PDF, JPG, PNG)');
  const originalName = file.name.replace(/[^a-zA-Z0-9-_.\s]/g, '_');
  return { originalName, mimeType };
}

export async function saveOrdenDocument(file: File, organizationId: string, ordenId: string) {
  const { originalName, mimeType } = validateOrdenDocumentUpload({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash('sha256').update(buffer).digest('hex');
  const storage = getStorage();
  const stored = await storage.put({
    prefix: `organizations/${organizationId}/compras/ordenes/${ordenId}/documentos`,
    originalName,
    mimeType,
    size: file.size,
    buffer,
    desiredName: originalName.replace(/\s+/g, '_'),
  });
  return {
    nombre: originalName,
    originalName,
    mimeType,
    size: stored.size,
    storageKey: stored.key,
    url: stored.url,
    fileHash,
  };
}

export async function saveOrdenPdf(buffer: Buffer, organizationId: string, ordenId: string, filename: string) {
  if (!buffer.length) throw new Error('EMPTY_PURCHASE_ORDER_PDF');

  const storage = getStorage();
  const stored = await storage.put({
    prefix: `organizations/${organizationId}/compras/ordenes/${ordenId}/pdf`,
    originalName: filename,
    mimeType: 'application/pdf',
    size: buffer.length,
    buffer,
    desiredName: filename,
  });
  if (!stored?.key) throw new Error('PURCHASE_ORDER_PDF_STORAGE_FAILED');

  return { storageKey: stored.key, url: stored.url, size: stored.size };
}
