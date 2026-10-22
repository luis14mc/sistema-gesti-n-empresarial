// =====================================================
// Storage Adapter — Contrato e interfaces
// Sprint 1: definir contrato; Sprint 2: completar drivers
// =====================================================

/**
 * Metadatos de un objeto subido.
 * `url` puede ser:
 *  - relativa (LocalStorageAdapter: `/uploads/...`)
 *  - pública (S3StorageAdapter con bucket público o CloudFront)
 *  - firmada (S3StorageAdapter.getSignedUrl)
 */
export interface PutObjectResult {
  key: string;          // clave lógica (sin dominio), ej: "oficios/2026/07/file.pdf"
  url: string;          // URL usable (puede ser signed URL)
  filename: string;     // nombre sanitizado final en el storage
  mimeType: string;
  size: number;
  uploadedAt: string;   // ISO 8601
  bucket?: string;      // solo S3
}

/**
 * Input genérico para subir un archivo al storage.
 * `buffer` se prefiere sobre `file` para entornos donde `File` no exista
 * (Edge runtime, Node).
 */
export interface PutObjectInput {
  /**
   * Prefijo lógico (ej: "oficios", "equipment/assignments").
   * El adapter puede agregar año/mes automáticamente.
   */
  prefix: string;
  /**
   * Nombre original del archivo (se sanitiza dentro del adapter).
   */
  originalName: string;
  mimeType: string;
  size: number;
  /**
   * Buffer binario (preferido para Node).
   */
  buffer: Buffer | Uint8Array;
  /**
   * Opcional: nombre final deseado. Si no se da, se genera UUID.
   */
  desiredName?: string;
}

export interface GetObjectResult {
  buffer: Buffer;
  mimeType: string;
  size: number;
}

/**
 * Adaptador de almacenamiento — contrato que deben cumplir
 * tanto LocalStorageAdapter (dev) como S3StorageAdapter (prod).
 */
export interface StorageAdapter {
  /**
   * Nombre legible del driver (para logs y healthcheck).
   */
  readonly driverName: string;

  /**
   * Sube un objeto y retorna metadatos + URL accesible.
   */
  put(input: PutObjectInput): Promise<PutObjectResult>;

  /**
   * Borra un objeto por clave lógica.
   * No-op si no existe (idempotente).
   */
  remove(key: string): Promise<void>;

  /**
   * Retorna una URL accesible. Por defecto usa la URL cacheada.
   * En S3 con archivos privados, generar signed URL on-demand.
   */
  getUrl(key: string): Promise<string>;

  /**
   * Lee el contenido binario de un objeto almacenado.
   */
  get(key: string, mimeTypeHint?: string): Promise<GetObjectResult>;

  /**
   * Chequeo barato de disponibilidad del backend (no escribe).
   * Para healthchecks: errores deben propagarse como throw.
   */
  ping?(): Promise<void>;
}
