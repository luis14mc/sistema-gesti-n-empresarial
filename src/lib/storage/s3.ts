// =====================================================
// S3 Storage Adapter — PRODUCCIÓN AWS
// Sprint 2: driver completo con signed URLs
// Requiere: @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner
// =====================================================

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import type { PutObjectInput, PutObjectResult, StorageAdapter } from './types';

export interface S3AdapterConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * URL base para archivos públicos (CloudFront o website endpoint).
   * Si se define, getUrl() la usa directamente sin firmar.
   */
  publicUrlBase?: string;
  /**
   * Prefijo lógico raíz dentro del bucket (ej: "sge/uploads").
   * Default: ""
   */
  keyPrefix?: string;
  /**
   * TTL en segundos para signed URLs de archivos privados.
   * Default: 900 (15 min).
   */
  signedUrlTtlSeconds?: number;
  /**
   * ACL por defecto para objetos subidos.
   * Default: "private" (forzar signed URL para descarga).
   */
  defaultAcl?: 'private' | 'public-read';
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
}

function buildObjectKey(prefix: string, input: PutObjectInput): {
  key: string;
  filename: string;
} {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = now.toISOString().replace(/[:.]/g, '-');

  const ext = input.originalName.includes('.')
    ? '.' + input.originalName.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '')
    : '';

  const filename = input.desiredName
    ? sanitizeFilename(input.desiredName)
    : `${sanitizeFilename(prefix).replace(/\//g, '-')}-${timestamp}-${randomUUID()}${ext}`;

  const keyParts = [prefix, year, month, filename].filter(Boolean);
  return {
    key: keyParts.join('/'),
    filename,
  };
}

export class S3StorageAdapter implements StorageAdapter {
  readonly driverName = 's3';
  private readonly client: S3Client;
  private readonly keyPrefix: string;

  constructor(private readonly config: S3AdapterConfig) {
    if (!config.bucket) throw new Error('S3StorageAdapter: bucket requerido');
    if (!config.region) throw new Error('S3StorageAdapter: region requerida');

    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    this.keyPrefix = (config.keyPrefix ?? '').replace(/^\/+|\/+$/g, '');
  }

  /**
   * Compone la clave lógica completa en el bucket (incluye prefijo raíz).
   */
  private fullKey(relativeKey: string): string {
    return this.keyPrefix ? `${this.keyPrefix}/${relativeKey}` : relativeKey;
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const { key, filename } = buildObjectKey(input.prefix, input);
    const fullKey = this.fullKey(key);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: fullKey,
        Body: input.buffer,
        ContentType: input.mimeType,
        ContentLength: input.size,
        ACL: this.config.defaultAcl ?? 'private',
        Metadata: {
          'original-name': encodeURIComponent(input.originalName.slice(0, 200)),
        },
      })
    );

    const url = await this.getUrl(key);

    return {
      key,
      url,
      filename,
      mimeType: input.mimeType,
      size: input.size,
      uploadedAt: new Date().toISOString(),
      bucket: this.config.bucket,
    };
  }

  async remove(key: string): Promise<void> {
    const fullKey = this.fullKey(key);
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: fullKey,
        })
      );
    } catch (err) {
      // Idempotente: si el objeto no existe o ya se borró, OK.
      const e = err as { name?: string; $metadata?: { statusCode?: number } };
      if (e?.name === 'NoSuchKey' || e?.$metadata?.statusCode === 404) {
        return;
      }
      throw err;
    }
  }

  async getUrl(key: string): Promise<string> {
    const fullKey = this.fullKey(key);

    // Si hay URL pública (CloudFront o website endpoint), usar directamente
    if (this.config.publicUrlBase) {
      return `${this.config.publicUrlBase.replace(/\/$/, '')}/${fullKey}`;
    }

    // Generar signed URL para descarga privada
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: fullKey,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: this.config.signedUrlTtlSeconds ?? 900,
    });
  }

  async get(key: string, mimeTypeHint?: string): Promise<import('./types').GetObjectResult> {
    const fullKey = this.fullKey(key);
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: fullKey,
      })
    );
    if (!response.Body) throw new Error('Archivo no encontrado');
    const bytes = await response.Body.transformToByteArray();
    const buffer = Buffer.from(bytes);
    return {
      buffer,
      mimeType: mimeTypeHint ?? response.ContentType ?? 'application/octet-stream',
      size: buffer.length,
    };
  }

  /**
   * Chequeo barato: HEAD sobre el bucket no es trivial en S3, así que
   * usamos ListBuckets (autorización) como ping. Si falla, propagar.
   */
  async ping(): Promise<void> {
    await this.client.send(
      new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: this.keyPrefix ? `${this.keyPrefix}/.keep` : '.keep',
      })
    ).catch(() => {
      // Silenciar: el objeto puede no existir, sólo validamos permisos.
    });
  }
}
