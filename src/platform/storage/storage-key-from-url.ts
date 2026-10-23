const EQUIPMENT_DOCUMENT_FILE_ROUTE = '/api/equipment/documents/file';

/**
 * Extrae la clave lógica (`organizations/{org}/...`) de una URL guardada en BD:
 * ruta estable de la app, URL https de S3/R2 (firmada o pública), o clave ya persistida.
 */
export function storageKeyFromStoredUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const value = url.trim();

  if (value.startsWith('organizations/') && !value.includes('..')) {
    return value;
  }

  if (value.startsWith(`${EQUIPMENT_DOCUMENT_FILE_ROUTE}?`)) {
    const key = new URLSearchParams(value.slice(value.indexOf('?') + 1)).get('key');
    return key || null;
  }

  if (!/^https:\/\//i.test(value)) return null;

  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(value).pathname);
  } catch {
    return null;
  }
  const index = pathname.indexOf('/organizations/');
  if (index === -1) return null;
  return pathname.slice(index + 1);
}
