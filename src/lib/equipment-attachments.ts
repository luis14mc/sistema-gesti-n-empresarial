import {
  EQUIPMENT_DOCUMENT_FILE_ROUTE,
  equipmentDocumentKeyFromUrl,
  isEquipmentDocumentKeyForOrganization,
} from '@/lib/equipment-document-access';

export const EQUIPMENT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export const EQUIPMENT_ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

export const EQUIPMENT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.sh', '.bat', '.cmd', '.com', '.msi', '.js', '.mjs', '.cjs',
  '.html', '.htm', '.php', '.py', '.rb', '.pl', '.jar',
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

export function validateEquipmentUploadFile(file: {
  name: string;
  type: string;
  size: number;
}): { extension: string; mimeType: string } {
  const extension = getFileExtension(file.name);

  if (!extension || !EQUIPMENT_ALLOWED_EXTENSIONS.has(extension)) {
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

  if (!EQUIPMENT_ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('Tipo MIME no permitido.');
  }

  if (file.size <= 0) throw new Error('El archivo está vacío.');
  if (file.size > EQUIPMENT_UPLOAD_MAX_BYTES) {
    throw new Error('El archivo supera el tamaño máximo de 10 MB.');
  }

  return { extension, mimeType };
}

/**
 * Valida que una URL de documento de asignación apunte al storage del propio
 * tenant (auditoría 2026-10-19, hardening 2). Acepta:
 *  - rutas locales "/uploads/..." que contengan "organizations/{org}/";
 *  - URLs https del endpoint de storage configurado (S3_ENDPOINT / S3_PUBLIC_URL)
 *    cuya ruta contenga "/organizations/{org}/".
 */
export function isEquipmentDocumentUrlAllowed(url: unknown, organizationId: string): boolean {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) return false;
  const tenantSegment = `organizations/${organizationId}/`;

  if (url.startsWith(`${EQUIPMENT_DOCUMENT_FILE_ROUTE}?`)) {
    return isEquipmentDocumentKeyForOrganization(equipmentDocumentKeyFromUrl(url), organizationId);
  }

  if (url.startsWith('/')) {
    return url.startsWith('/uploads/') && url.includes(tenantSegment) && !url.includes('..');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;

  const allowedHosts = [process.env.S3_ENDPOINT, process.env.S3_PUBLIC_URL]
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return new URL(value).hostname.toLowerCase();
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value));

  const host = parsed.hostname.toLowerCase();
  const hostAllowed = allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  return hostAllowed && decodeURIComponent(parsed.pathname).includes(`/${tenantSegment}`);
}
