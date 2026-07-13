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
