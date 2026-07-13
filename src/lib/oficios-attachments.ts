import type { OficioAttachment } from '@/types';

export const OFICIO_UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const OFICIO_ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

export const OFICIO_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.sh', '.bat', '.cmd', '.com', '.msi', '.js', '.mjs', '.cjs',
  '.html', '.htm', '.php', '.py', '.rb', '.pl', '.jar', '.app', '.deb', '.rpm',
]);

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

export function sanitizeOriginalName(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'documento';
}

export function validateOficioUploadFile(file: {
  name: string;
  type: string;
  size: number;
}): { extension: string; mimeType: string } {
  const extension = getFileExtension(file.name);

  if (!extension || !OFICIO_ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error('Formato no permitido. Solo PDF, JPG, JPEG y PNG.');
  }

  if (BLOCKED_EXTENSIONS.has(extension)) {
    throw new Error('Tipo de archivo no permitido por seguridad.');
  }

  let mimeType = file.type;
  if (!mimeType) {
    if (extension === '.pdf') mimeType = 'application/pdf';
    else if (extension === '.png') mimeType = 'image/png';
    else mimeType = 'image/jpeg';
  }

  if (!OFICIO_ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('Tipo MIME no permitido. Verifica que el archivo sea PDF o imagen válida.');
  }

  if (file.size <= 0) {
    throw new Error('El archivo está vacío.');
  }

  if (file.size > OFICIO_UPLOAD_MAX_BYTES) {
    throw new Error('El archivo supera el tamaño máximo de 10 MB.');
  }

  // Coherencia extensión ↔ MIME
  if (extension === '.pdf' && mimeType !== 'application/pdf') {
    throw new Error('La extensión del archivo no coincide con su contenido.');
  }
  if ((extension === '.jpg' || extension === '.jpeg' || extension === '.png') && !mimeType.startsWith('image/')) {
    throw new Error('La extensión del archivo no coincide con su contenido.');
  }

  return { extension, mimeType };
}

/** Normaliza attachments desde JSON de Prisma (objetos o URLs legacy). */
export function parseOficioAttachments(raw: unknown): OficioAttachment[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => normalizeOficioAttachment(item))
    .filter((item): item is OficioAttachment => item !== null);
}

export function normalizeOficioAttachment(item: unknown): OficioAttachment | null {
  if (typeof item === 'string' && item.trim()) {
    const url = item.trim();
    const filename = url.split('/').pop() || 'documento';
    const ext = getFileExtension(filename);
    const mimeType =
      ext === '.pdf' ? 'application/pdf'
      : ext === '.png' ? 'image/png'
      : 'image/jpeg';

    return {
      url,
      filename,
      originalName: filename,
      mimeType,
      size: 0,
      uploadedAt: new Date().toISOString(),
    };
  }

  if (!item || typeof item !== 'object') return null;

  const record = item as Record<string, unknown>;
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  if (!url) return null;

  const filename = typeof record.filename === 'string' ? record.filename : url.split('/').pop() || 'documento';
  const originalName = typeof record.originalName === 'string' ? record.originalName : filename;
  const mimeType = typeof record.mimeType === 'string' ? record.mimeType : 'application/octet-stream';
  const size = typeof record.size === 'number' ? record.size : 0;
  const uploadedAt = typeof record.uploadedAt === 'string' ? record.uploadedAt : new Date().toISOString();

  return { url, filename, originalName, mimeType, size, uploadedAt };
}

export function hasOficioDocument(raw: unknown): boolean {
  return parseOficioAttachments(raw).length > 0;
}

export function isPdfAttachment(attachment: OficioAttachment): boolean {
  return attachment.mimeType === 'application/pdf' || getFileExtension(attachment.filename) === '.pdf';
}

export function isImageAttachment(attachment: OficioAttachment): boolean {
  return attachment.mimeType.startsWith('image/');
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
