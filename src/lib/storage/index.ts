// =====================================================
// Storage — Factory
// Selecciona driver según STORAGE_DRIVER en .env
// =====================================================

import type { StorageAdapter } from './types';
import { LocalStorageAdapter } from './local';
import { S3StorageAdapter } from './s3';

let _instance: StorageAdapter | null = null;

/**
 * Retorna la instancia singleton del StorageAdapter según el entorno.
 * Lectura perezosa (lazy): se evalúa solo en el primer uso.
 *
 * Driver:
 *   - "local" (default dev): LocalStorageAdapter -> public/uploads
 *   - "s3"   (producción):   S3StorageAdapter (requiere AWS_* en env)
 */
export function getStorage(): StorageAdapter {
  if (_instance) return _instance;

  const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();

  if (driver === 's3') {
    const bucket = process.env.S3_BUCKET;
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'S3StorageAdapter: faltan variables S3_BUCKET/AWS_REGION/AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY'
      );
    }

    _instance = new S3StorageAdapter({
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
      publicUrlBase: process.env.S3_PUBLIC_URL,
      signedUrlTtlSeconds: process.env.S3_PRESIGNED_TTL_SECONDS
        ? Number(process.env.S3_PRESIGNED_TTL_SECONDS)
        : 900,
    });
  } else {
    _instance = new LocalStorageAdapter({
      baseDir: process.env.LOCAL_STORAGE_PATH
        ? `${process.env.LOCAL_STORAGE_PATH}`
        : undefined,
      publicPrefix: '/uploads',
    });
  }

  return _instance;
}

/**
 * Resetea la instancia cacheada (util en tests).
 */
export function resetStorageForTests(): void {
  _instance = null;
}

/**
 * Inyecta un adapter concreto (util en tests).
 */
export function setStorageForTests(adapter: StorageAdapter): void {
  _instance = adapter;
}

export type { StorageAdapter, PutObjectInput, PutObjectResult } from './types';
export { LocalStorageAdapter } from './local';
export { S3StorageAdapter } from './s3';
