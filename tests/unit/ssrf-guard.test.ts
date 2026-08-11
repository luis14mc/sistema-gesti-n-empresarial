// Phase 10B — domain unit tests for the SSRF guard.
import { describe, expect, it } from 'vitest';
import {
  checkUrlForSsrf,
  SSRF_PRIVATE_HOSTNAMES,
  SSRF_PRIVATE_IPV4_CIDRS,
  assertUrlIsSafe,
  SsrfBlockedHostError,
} from '@/platform/integrations/application/ssrf-guard';

describe('checkUrlForSsrf', () => {
  it('accepts a public https URL', () => {
    expect(checkUrlForSsrf('https://api.example.com/v1/users')).toEqual({ ok: true });
  });

  it('accepts a public http URL', () => {
    expect(checkUrlForSsrf('http://example.com')).toEqual({ ok: true });
  });

  it('rejects an invalid URL', () => {
    expect(checkUrlForSsrf('not-a-url')).toMatchObject({ ok: false, reason: 'invalid_url' });
  });

  it('rejects unsupported protocols', () => {
    expect(checkUrlForSsrf('file:///etc/passwd')).toMatchObject({ ok: false, reason: 'unsupported_protocol' });
    expect(checkUrlForSsrf('ftp://example.com/file')).toMatchObject({ ok: false, reason: 'unsupported_protocol' });
    expect(checkUrlForSsrf('javascript:alert(1)')).toMatchObject({ ok: false, reason: 'unsupported_protocol' });
  });

  it('rejects the localhost hostname', () => {
    expect(checkUrlForSsrf('http://localhost:3000/admin')).toMatchObject({ ok: false, reason: 'private_hostname' });
  });

  it('rejects the private IPv4 ranges listed in the catalogue', () => {
    expect(checkUrlForSsrf('http://10.0.0.5')).toMatchObject({ ok: false, reason: 'private_ipv4' });
    expect(checkUrlForSsrf('http://172.16.0.1')).toMatchObject({ ok: false, reason: 'private_ipv4' });
    expect(checkUrlForSsrf('http://192.168.1.10')).toMatchObject({ ok: false, reason: 'private_ipv4' });
    expect(checkUrlForSsrf('http://127.0.0.1')).toMatchObject({ ok: false, reason: 'private_ipv4' });
    expect(checkUrlForSsrf('http://169.254.169.254/')).toMatchObject({ ok: false, reason: 'private_ipv4' });
  });

  it('rejects private IPv6 ranges', () => {
    expect(checkUrlForSsrf('http://[::1]')).toMatchObject({ ok: false, reason: 'private_ipv6' });
    expect(checkUrlForSsrf('http://[fc00::1]')).toMatchObject({ ok: false, reason: 'private_ipv6' });
    expect(checkUrlForSsrf('http://[fe80::1]')).toMatchObject({ ok: false, reason: 'private_ipv6' });
  });

  it('honours the allowedHostnames opt-in for ephemeral test endpoints', () => {
    const policy = { allowPrivateNetworks: false, allowedHostnames: new Set(['localhost']) };
    expect(checkUrlForSsrf('http://localhost:3000', policy)).toEqual({ ok: true });
  });

  it('lets allowPrivateNetworks bypass the guard for staging test runs', () => {
    const policy = { allowPrivateNetworks: true };
    expect(checkUrlForSsrf('http://10.0.0.1', policy)).toEqual({ ok: true });
  });
});

describe('SSRF allowed-list catalogues', () => {
  it('exposes a non-empty list of private IPv4 CIDRs', () => {
    expect(SSRF_PRIVATE_IPV4_CIDRS.length).toBeGreaterThan(0);
    expect(SSRF_PRIVATE_IPV4_CIDRS).toContain('127.0.0.0/8');
    expect(SSRF_PRIVATE_IPV4_CIDRS).toContain('10.0.0.0/8');
  });

  it('exposes a non-empty set of private hostnames', () => {
    expect(SSRF_PRIVATE_HOSTNAMES.size).toBeGreaterThan(0);
    expect(SSRF_PRIVATE_HOSTNAMES.has('localhost')).toBe(true);
    expect(SSRF_PRIVATE_HOSTNAMES.has('metadata.google.internal')).toBe(true);
  });
});

describe('assertUrlIsSafe', () => {
  it('returns the parsed URL when the host is safe', () => {
    const url = assertUrlIsSafe('https://api.example.com/v1');
    expect(url.hostname).toBe('api.example.com');
  });

  it('throws SsrfBlockedHostError when the host is private', () => {
    expect(() => assertUrlIsSafe('http://localhost:3000')).toThrow(SsrfBlockedHostError);
  });
});
