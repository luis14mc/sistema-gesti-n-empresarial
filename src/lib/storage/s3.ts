// =====================================================
// S3 Storage Adapter — PRODUCCIÓN AWS
// Sprint 1: contrato + stubs (driver completo en Sprint 2)
// Requiere: @aws-sdk/client-s3 (instalar en Sprint 2)
// =====================================================

import type { PutObjectInput, PutObjectResult, StorageAdapter } from './types';

export interface S3AdapterConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * URL base para archivos públicos (CloudFront o website endpoint).
   * Si se define, getUrl() la usa directamente.
   */
  publicUrlBase?: string;
  /**
   * TTL en segundos para signed URLs de archivos privados.
   * Default: 900 (15 min).
   */
  signedUrlTtlSeconds?: number;
}

/**
 * Driver S3 (stub). La implementación completa se entrega en Sprint 2
 * tras instalar `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.
 *
 * Mientras tanto, `put()` guarda en una carpeta temporal y `getUrl()`
 * retorna una URL relativa. Esto permite no bloquear desarrollo local
 * con dependencias de AWS.
 */
export class S3StorageAdapter implements StorageAdapter {
  readonly driverName = 's3';

  constructor(private readonly config: S3AdapterConfig) {
    if (!config.bucket) throw new Error('S3StorageAdapter: bucket requerido');
    if (!config.region) throw new Error('S3StorageAdapter: region requerida');
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    throw new Error(
      'S3StorageAdapter: driver no implementado. ' +
      'Instale @aws-sdk/client-s3 para activar (Sprint 2).'
    );
  }

  async remove(_key: string): Promise<void> {
    throw new Error(
      'S3StorageAdapter: driver no implementado. ' +
      'Instale @aws-sdk/client-s3 para activar (Sprint 2).'
    );
  }

  async getUrl(key: string): Promise<string> {
    if (this.config.publicUrlBase) {
      return `${this.config.publicUrlBase.replace(/\/$/, '')}/${key}`;
    }
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }
}
