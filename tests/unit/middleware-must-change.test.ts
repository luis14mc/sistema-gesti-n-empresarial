import { describe, expect, it } from 'vitest';
import { buildRequestRedirectUrl, postLoginPathForRole } from '@/middleware';
import { NextRequest } from 'next/server';

describe('mustChangePassword navigation helpers', () => {
  it('postLoginPathForRole sends users to forced password change', () => {
    expect(postLoginPathForRole('ADMIN', true)).toBe('/settings/cambiar-contrasena');
    expect(postLoginPathForRole('ADMIN', false)).toBe('/dashboard');
  });

  it('maps cambiar-contrasena in route access as dashboard module', async () => {
    const { ROUTE_PATH_TO_MODULE } = await import('@/platform/security/route-access');
    expect(ROUTE_PATH_TO_MODULE['/settings/cambiar-contrasena']).toBe('dashboard');
  });

  it('buildRequestRedirectUrl preserves localhost dev port', () => {
    const req = new NextRequest('http://localhost:3000/dashboard');
    const url = buildRequestRedirectUrl(req, '/settings/cambiar-contrasena', 'development');
    expect(url.pathname).toBe('/settings/cambiar-contrasena');
    expect(url.protocol).toBe('http:');
  });
});
