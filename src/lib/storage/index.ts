// =====================================================
// Storage — Factory
// Selecciona driver según STORAGE_DRIVER en .env
// =====================================================

import type { StorageAdapter } from './types';
import { LocalStorageAdapter } from './local';
import { S3StorageAdapter } from './s3';
import { validateStorageEnvironment } from '@/platform/config/env';

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

  const environment = validateStorageEnvironment(process.env);
  const driver = environment.STORAGE_DRIVER;

  if (driver === 's3') {
    _instance = new S3StorageAdapter({
      bucket: environment.S3_BUCKET!,
      region: environment.AWS_REGION!,
      accessKeyId: environment.AWS_ACCESS_KEY_ID,
      secretAccessKey: environment.AWS_SECRET_ACCESS_KEY,
      sessionToken: environment.AWS_SESSION_TOKEN,
      endpoint: environment.S3_ENDPOINT,
      forcePathStyle: environment.S3_FORCE_PATH_STYLE,
      keyPrefix: environment.APP_ENV,
      requireTenantPrefix: environment.APP_ENV === 'staging' || environment.APP_ENV === 'production',
      publicUrlBase: environment.S3_PUBLIC_URL,
      signedUrlTtlSeconds: environment.S3_PRESIGNED_TTL_SECONDS,
    });
  } else {
    _instance = new LocalStorageAdapter({
      baseDir: environment.LOCAL_STORAGE_PATH,
      publicPrefix: `/uploads/${environment.APP_ENV}`,
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
