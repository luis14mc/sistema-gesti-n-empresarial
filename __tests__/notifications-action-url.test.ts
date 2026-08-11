import { describe, expect, it } from 'vitest';
import { normalizeInternalPath } from '@/modules/notifications/application/action-url';
import { InvalidNotificationActionUrlError } from '@/modules/notifications/domain/errors';

describe('normalizeInternalPath', () => {
  it('accepts absolute internal paths', () => {
    expect(normalizeInternalPath('/ajustes/organizacion')).toBe('/ajustes/organizacion');
  });

  it('requires a leading slash', () => {
    expect(() => normalizeInternalPath('notificaciones/123')).toThrow(InvalidNotificationActionUrlError);
  });

  it('rejects absolute http(s) URLs', () => {
    expect(() => normalizeInternalPath('https://malicious.example.com/redirect')).toThrow(InvalidNotificationActionUrlError);
  });

  it('rejects protocol-relative URLs', () => {
    expect(() => normalizeInternalPath('//malicious.example.com/redirect')).toThrow(InvalidNotificationActionUrlError);
  });

  it('rejects javascript: and data: schemes', () => {
    expect(() => normalizeInternalPath('javascript:alert(1)')).toThrow(InvalidNotificationActionUrlError);
    expect(() => normalizeInternalPath('data:text/html,evil')).toThrow(InvalidNotificationActionUrlError);
  });

  it('rejects CRLF injection', () => {
    expect(() => normalizeInternalPath('/foo\r\nLocation: x')).toThrow(InvalidNotificationActionUrlError);
  });

  it('returns null for empty input', () => {
    expect(normalizeInternalPath(null)).toBe(null);
    expect(normalizeInternalPath('')).toBe(null);
    expect(normalizeInternalPath('   ')).toBe(null);
  });
});
