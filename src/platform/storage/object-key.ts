import { randomUUID } from 'crypto';
import type { PutObjectInput } from './types';

const MAX_OBJECT_FILENAME_LENGTH = 120;

export function sanitizeStorageFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
}

function normalizeExtension(originalName: string): string {
  if (!originalName.includes('.')) return '';
  const raw = originalName.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '');
  return raw ? `.${raw}` : '';
}

function stripExtension(name: string): string {
  const lastDot = name.lastIndexOf('.');
  if (lastDot <= 0) return name;
  return name.slice(0, lastDot);
}

/** Truncates base so base+ext fits within maxLen (ext preserved). */
function truncateFilenameBase(base: string, ext: string, maxLen: number): string {
  const allowedBase = Math.max(1, maxLen - ext.length);
  if (base.length <= allowedBase) return `${base}${ext}`;
  return `${base.slice(0, allowedBase)}${ext}`;
}

export function buildObjectKey(
  prefix: string,
  input: PutObjectInput,
  options?: { objectId?: string },
): { key: string; filename: string } {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const ext = normalizeExtension(input.originalName);

  let filename: string;

  if (input.overwrite) {
    const rawName = input.desiredName ?? input.originalName;
    let sanitized = sanitizeStorageFilename(rawName);
    if (ext && !sanitized.toLowerCase().endsWith(ext)) {
      sanitized = `${stripExtension(sanitized)}${ext}`;
    }
    filename =
      sanitized.length <= MAX_OBJECT_FILENAME_LENGTH
        ? sanitized
        : sanitized.slice(0, MAX_OBJECT_FILENAME_LENGTH);
  } else {
    const objectId = options?.objectId ?? randomUUID();
    const nameSource = input.desiredName ?? input.originalName;
    const sanitizedBase = sanitizeStorageFilename(stripExtension(nameSource)) || 'documento';
    filename = truncateFilenameBase(`${objectId}-${sanitizedBase}`, ext, MAX_OBJECT_FILENAME_LENGTH);
  }

  const keyParts = [prefix, year, month, filename].filter(Boolean);
  return {
    key: keyParts.join('/'),
    filename,
  };
}
