import { InvalidNotificationActionUrlError } from '../domain/errors';

const ALLOWED_PATH_PATTERN = /^\/[a-zA-Z0-9_\-/?.#&=:%@+,]*$/u;
const FORBIDDEN_PATH_PREFIXES = ['//', 'http://', 'https://', 'javascript:', 'data:', 'vbscript:'];

export function normalizeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (FORBIDDEN_PATH_PREFIXES.some((prefix) => trimmed.toLowerCase().startsWith(prefix))) {
    throw new InvalidNotificationActionUrlError(trimmed);
  }
  if (trimmed.includes('\n') || trimmed.includes('\r') || trimmed.includes('\0')) {
    throw new InvalidNotificationActionUrlError(trimmed);
  }
  if (!ALLOWED_PATH_PATTERN.test(trimmed)) {
    throw new InvalidNotificationActionUrlError(trimmed);
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function assertSafeInternalPath(value: string): string {
  return normalizeInternalPath(value) ?? '';
}
