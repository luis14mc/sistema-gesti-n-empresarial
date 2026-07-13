// =====================================================
// Local Storage Adapter — solo DESARROLLO
// Sprint 1: implementación completa sobre FS local.
// Sprint 2: usar S3StorageAdapter en producción AWS.
// =====================================================

import { mkdir, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { PutObjectInput, PutObjectResult, StorageAdapter } from './types';

const DEFAULT_BASE = path.join(process.cwd(), 'public');

export class LocalStorageAdapter implements StorageAdapter {
  readonly driverName = 'local';

  constructor(
    private readonly options: {
      baseDir?: string;       // absoluto; default = process.cwd()/public
      publicPrefix?: string;  // default = '/uploads'
    } = {}
  ) {}

  private get baseDir() {
    return this.options.baseDir ?? DEFAULT_BASE;
  }

  private get publicPrefix() {
    return this.options.publicPrefix ?? '/uploads';
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
  }

  private getExtension(name: string): string {
    const ext = path.extname(name);
    return ext ? ext.toLowerCase() : '';
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const ext = this.getExtension(input.originalName);
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = now.toISOString().replace(/[:.]/g, '-');

    const sanitizedOriginal = this.sanitizeFilename(input.originalName);
    const desired = input.desiredName
      ? this.sanitizeFilename(input.desiredName)
      : `${prefixSlug(input.prefix)}-${timestamp}-${randomUUID()}${ext}`;

    const relativeDir = path.join(this.publicPrefix.replace(/^\//, ''), input.prefix, year, month);
    const absoluteDir = path.join(this.baseDir, relativeDir);
    await mkdir(absoluteDir, { recursive: true });

    const absolutePath = path.join(absoluteDir, desired);
    await writeFile(absolutePath, input.buffer);

    const url = `/${path.join(relativeDir, desired).replace(/\\/g, '/')}`;
    const key = `${input.prefix}/${year}/${month}/${desired}`;

    return {
      key,
      url,
      filename: desired,
      mimeType: input.mimeType,
      size: input.size,
      uploadedAt: now.toISOString(),
    };
  }

  async remove(key: string): Promise<void> {
    const relative = key.replace(/^\/+/, '');
    const absolute = path.join(this.baseDir, relative);
    await unlink(absolute).catch(() => {
      // idempotente: borrar lo que no existe es OK
    });
  }

  async getUrl(key: string): Promise<string> {
    return `/${key.replace(/^\/+/, '')}`;
  }
}

function prefixSlug(prefix: string): string {
  return prefix.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');
}
