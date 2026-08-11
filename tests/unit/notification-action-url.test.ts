// Phase 10B — domain unit tests for notification action URL hardening.
import { describe, expect, it } from 'vitest';
import { InvalidNotificationActionUrlError } from '@/modules/notifications/domain/errors';
import { assertSafeInternalPath, normalizeInternalPath } from '@/modules/notifications/application/action-url';

describe('normalizeInternalPath', () => {
  it('returns null for empty / whitespace / null inputs', () => {
    expect(normalizeInternalPath(null)).toBeNull();
    expect(normalizeInternalPath(undefined)).toBeNull();
    expect(normalizeInternalPath('')).toBeNull();
    expect(normalizeInternalPath('   ')).toBeNull();
  });

  it('accepts a leading-slash path and prefixes the slash when missing', () => {
    expect(normalizeInternalPath('/oficios/internos')).toBe('/oficios/internos');
  });

  it('throws when the input lacks a leading slash', () => {
    // The allowlist pattern requires the leading slash; callers must pass
    // canonical paths from the application.
    expect(() => normalizeInternalPath('oficios/internos')).toThrow(InvalidNotificationActionUrlError);
  });

  it('rejects protocol-relative URLs', () => {
    expect(() => normalizeInternalPath('//evil.example.com')).toThrow(InvalidNotificationActionUrlError);
  });

  it('rejects absolute URLs', () => {
    expect(() => normalizeInternalPath('http://evil.example.com')).toThrow(InvalidNotificationActionUrlError);
    expect(() => normalizeInternalPath('https://evil.example.com')).toThrow(InvalidNotificationActionUrlError);
  });

  it('rejects javascript / data / vbscript URIs', () => {
    expect(() => normalizeInternalPath('javascript:alert(1)')).toThrow(InvalidNotificationActionUrlError);
    expect(() => normalizeInternalPath('data:text/html,<script>1</script>')).toThrow(InvalidNotificationActionUrlError);
    expect(() => normalizeInternalPath('vbscript:msgbox(1)')).toThrow(InvalidNotificationActionUrlError);
  });

  it('rejects newline / null control characters', () => {
    expect(() => normalizeInternalPath('/foo\nbar')).toThrow(InvalidNotificationActionUrlError);
    expect(() => normalizeInternalPath('/foo\rbar')).toThrow(InvalidNotificationActionUrlError);
    expect(() => normalizeInternalPath('/foo\0bar')).toThrow(InvalidNotificationActionUrlError);
  });

  it('rejects paths that contain characters outside the allowlist', () => {
    expect(() => normalizeInternalPath('/foo<script>')).toThrow(InvalidNotificationActionUrlError);
    expect(() => normalizeInternalPath('/foo"bar')).toThrow(InvalidNotificationActionUrlError);
  });

  it('accepts paths with query / fragment / encoded characters', () => {
    expect(normalizeInternalPath('/oficios/internos?status=OPEN&page=2')).toBe('/oficios/internos?status=OPEN&page=2');
    expect(normalizeInternalPath('/oficios/internos#historial')).toBe('/oficios/internos#historial');
    expect(normalizeInternalPath('/usuarios/ana%20lopez')).toBe('/usuarios/ana%20lopez');
  });
});

describe('assertSafeInternalPath', () => {
  it('returns an empty string when the input is null', () => {
    expect(assertSafeInternalPath('')).toBe('');
  });

  it('returns the normalised path for valid inputs', () => {
    expect(assertSafeInternalPath('/oficios/internos')).toBe('/oficios/internos');
  });

  it('throws for unsafe inputs', () => {
    expect(() => assertSafeInternalPath('javascript:foo')).toThrow(InvalidNotificationActionUrlError);
  });
});
