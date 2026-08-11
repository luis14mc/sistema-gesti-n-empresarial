import { describe, expect, it } from 'vitest';
import { checkUrlForSsrf, assertUrlIsSafe, SsrfBlockedHostError } from '@/platform/integrations/application/ssrf-guard';

describe('ssrfGuard', () => {
  it('blocks loopback and private networks by default', () => {
    for (const url of [
      'http://localhost:8080/admin',
      'http://127.0.0.1/x',
      'http://10.0.0.1/x',
      'http://192.168.0.1/x',
      'http://172.16.5.5/x',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/x',
    ]) {
      expect(checkUrlForSsrf(url).ok).toBe(false);
    }
  });

  it('accepts public hosts over https', () => {
    expect(checkUrlForSsrf('https://graph.microsoft.com/v1.0/me').ok).toBe(true);
    expect(checkUrlForSsrf('https://login.microsoftonline.com').ok).toBe(true);
  });

  it('rejects non-http(s) protocols', () => {
    expect(checkUrlForSsrf('ftp://example.com').ok).toBe(false);
    expect(checkUrlForSsrf('javascript:alert(1)').ok).toBe(false);
  });

  it('honours allowlist when private networks are otherwise blocked', () => {
    const policy = { allowPrivateNetworks: false, allowedHostnames: new Set(['internal.example.com']) };
    expect(checkUrlForSsrf('http://internal.example.com:8000/api', policy).ok).toBe(true);
  });

  it('throws on blocked URL when assertUrlIsSafe is called', () => {
    expect(() => assertUrlIsSafe('http://127.0.0.1/x')).toThrowError(SsrfBlockedHostError);
  });
});
