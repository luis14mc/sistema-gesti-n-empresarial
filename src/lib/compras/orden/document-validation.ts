const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

export function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

export function validatePurchaseDocumentFile(
  file: File,
  existing: Array<{ file: File }> = []
): string | null {
  if (!file || file.size === 0) return 'El archivo está vacío';
  if (file.size > MAX_DOCUMENT_SIZE) return 'El archivo excede el tamaño máximo de 10 MB';
  if (!ALLOWED_MIME.has(file.type)) return 'Tipo de archivo no permitido (PDF, JPG, PNG)';
  const ext = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) return 'Extensión de archivo no permitida';
  const duplicate = existing.some(
    (item) => item.file.name === file.name && item.file.size === file.size
  );
  if (duplicate) return 'Ya existe un archivo con el mismo nombre y tamaño';
  return null;
}
