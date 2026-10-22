// =====================================================
// Local Storage Adapter — solo DESARROLLO
// Sprint 1: implementación completa sobre FS local.
// Sprint 2: usar S3StorageAdapter en producción AWS.
// =====================================================

import { access, mkdir, writeFile, unlink, readFile } from 'fs/promises';
import { constants } from 'fs';
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

  private resolveKey(key: string): string {
    const root = path.resolve(this.baseDir);
    const resolved = path.resolve(root, key.replace(/^[/\\]+/, ''));
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error('INVALID_STORAGE_KEY');
    }
    return resolved;
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

    const desired = input.desiredName
      ? this.sanitizeFilename(input.desiredName)
      : `${prefixSlug(input.prefix)}-${timestamp}-${randomUUID()}${ext}`;

    const relativeDir = path.join(this.publicPrefix.replace(/^\//, ''), input.prefix, year, month);
    const absoluteDir = this.resolveKey(relativeDir);
    await mkdir(absoluteDir, { recursive: true });

    const absolutePath = path.join(absoluteDir, desired);
    await writeFile(absolutePath, input.buffer);

    const relativePath = path.join(relativeDir, desired).replace(/\\/g, '/');
    const url = `/${relativePath}`;
    const key = relativePath;

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
    const absolute = this.resolveKey(relative);
    await unlink(absolute).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  async getUrl(key: string): Promise<string> {
    return `/${key.replace(/^\/+/, '')}`;
  }

  async get(key: string, mimeTypeHint?: string): Promise<import('./types').GetObjectResult> {
    const relative = key.replace(/^\/+/, '');
    const absolute = this.resolveKey(relative);
    const buffer = await readFile(absolute);
    const ext = this.getExtension(key);
    const mimeType = mimeTypeHint ?? mimeFromExtension(ext);
    return { buffer, mimeType, size: buffer.length };
  }

  async ping(): Promise<void> {
    const uploadRoot = this.resolveKey(this.publicPrefix);
    await mkdir(uploadRoot, { recursive: true });
    await access(uploadRoot, constants.R_OK | constants.W_OK);
  }
}

function prefixSlug(prefix: string): string {
  return prefix.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');
}

function mimeFromExtension(ext: string): string {
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}
