/**
 * Acceso estable a documentos de Equipos (actas de entrega/devolución).
 *
 * Problema: con STORAGE_DRIVER=s3 (R2 privado) el upload devolvía una URL
 * firmada que vence a los S3_PRESIGNED_TTL_SECONDS (900 s) y se guardaba tal
 * cual en BD, por lo que el enlace al acta dejaba de funcionar.
 *
 * Solución: se guarda/expone una ruta propia de la app que resuelve la clave
 * del objeto en cada solicitud (con auth + tenant). Las filas antiguas que
 * tienen una URL firmada se normalizan al leerlas, sin migración de datos.
 */

export const EQUIPMENT_DOCUMENT_FILE_ROUTE = '/api/equipment/documents/file';

/** Construye la URL estable para una clave de storage. */
export function equipmentDocumentFileUrl(storageKey: string): string {
  return `${EQUIPMENT_DOCUMENT_FILE_ROUTE}?key=${encodeURIComponent(storageKey)}`;
}

/** Valida que la clave pertenezca al tenant y no tenga traversal. */
export function isEquipmentDocumentKeyForOrganization(key: unknown, organizationId: string): key is string {
  if (typeof key !== 'string' || key.length === 0 || key.length > 1024) return false;
  if (key.includes('..') || key.includes('\\') || key.startsWith('/')) return false;
  return key.startsWith(`organizations/${organizationId}/`);
}

/**
 * Extrae la clave lógica ("organizations/{org}/...") de una URL guardada:
 *  - ruta estable de la app (`/api/equipment/documents/file?key=...`)
 *  - URL https de S3/R2 (firmada o pública), con o sin bucket/APP_ENV en la ruta
 * Devuelve null para rutas locales (`/uploads/...`) u otras URLs.
 */
export function equipmentDocumentKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  if (url.startsWith(`${EQUIPMENT_DOCUMENT_FILE_ROUTE}?`)) {
    const key = new URLSearchParams(url.slice(url.indexOf('?') + 1)).get('key');
    return key || null;
  }

  if (!/^https:\/\//i.test(url)) return null;
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
  const index = pathname.indexOf('/organizations/');
  if (index === -1) return null;
  return pathname.slice(index + 1);
}

/**
 * Normaliza una URL de documento para el cliente: las URLs de S3/R2
 * (que pueden estar vencidas) se reemplazan por la ruta estable.
 */
export function toEquipmentDocumentHref(url: string | null | undefined): string | null {
  if (!url) return url ?? null;
  if (url.startsWith('/')) return url;
  const key = equipmentDocumentKeyFromUrl(url);
  return key ? equipmentDocumentFileUrl(key) : url;
}

type DocumentUrlFields = {
  deliveryDocumentUrl?: string | null;
  returnDocumentUrl?: string | null;
  urlNotaPdf?: string | null;
};

export function withStableEquipmentDocumentUrls<T extends DocumentUrlFields>(assignment: T): T {
  return {
    ...assignment,
    deliveryDocumentUrl: toEquipmentDocumentHref(assignment.deliveryDocumentUrl),
    returnDocumentUrl: toEquipmentDocumentHref(assignment.returnDocumentUrl),
    urlNotaPdf: toEquipmentDocumentHref(assignment.urlNotaPdf),
  };
}
