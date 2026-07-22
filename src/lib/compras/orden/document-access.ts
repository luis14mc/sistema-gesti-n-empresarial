import { getStorage } from '@/lib/storage';

export async function readStoredDocument(
  storageKey: string,
  mimeTypeHint?: string
): Promise<{ buffer: Buffer; mimeType: string; size: number }> {
  const storage = getStorage();
  return storage.get(storageKey, mimeTypeHint);
}

export async function removeStoredDocument(storageKey: string): Promise<void> {
  const storage = getStorage();
  await storage.remove(storageKey);
}

function sanitizeContentDispositionFilename(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, '_').slice(0, 200);
}

export function buildInlineContentDisposition(filename: string): string {
  const safe = sanitizeContentDispositionFilename(filename);
  return `inline; filename="${safe}"`;
}

export function buildAttachmentContentDisposition(filename: string): string {
  const safe = sanitizeContentDispositionFilename(filename);
  return `attachment; filename="${safe}"`;
}
