import { describe, expect, it } from 'vitest';
import { buildRequestRedirectUrl } from '@/middleware';

describe('runtime navigation hotfix', () => {
  it('keeps localhost development redirects on HTTP', () => {
    const request = new Request('https://localhost:3000/employees') as unknown as import('next/server').NextRequest;
    const url = buildRequestRedirectUrl(request, '/login');
    expect(url.toString()).toBe('http://localhost:3000/login');
  });

  it('preserves configured HTTPS outside development', () => {
    const request = new Request('https://cni.example.com/employees') as unknown as import('next/server').NextRequest;
    expect(buildRequestRedirectUrl(request, '/login', 'production').toString()).toBe('https://cni.example.com/login');
  });
});
