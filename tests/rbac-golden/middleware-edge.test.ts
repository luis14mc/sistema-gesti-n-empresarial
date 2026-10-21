import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { middleware } from '@/middleware';

const TEST_SECRET = 'a'.repeat(48);

type TokenExtra = {
  mod?: string;
  spe?: string;
  mustChangePassword?: boolean;
};

function signToken(role: string, extra: TokenExtra = {}) {
  return jwt.sign(
    {
      userId: 'user-1',
      email: 'user@cni.hn',
      role,
      jti: 'jti-1',
      mustChangePassword: extra.mustChangePassword === true ? true : undefined,
      ...extra,
    },
    TEST_SECRET,
    { algorithm: 'HS256', expiresIn: '15m', issuer: 'sge', audience: 'sge-web' },
  );
}

function request(path: string, token?: string) {
  const headers = new Headers();
  if (token) headers.set('cookie', `token=${token}`);
  return new NextRequest(new URL(path, 'http://localhost:3000'), { headers });
}

function location(response: Response) {
  return new URL(response.headers.get('location') ?? '', 'http://localhost:3000').pathname;
}

describe('RBAC golden — middleware Edge (JWT mod/spe/mustChangePassword)', () => {
  let previousSecret: string | undefined;

  beforeEach(() => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('/dashboard sin token → /login', async () => {
    const response = await middleware(request('/dashboard'));
    expect(location(response)).toBe('/login');
  });

  it('/users con token sin módulo users en mod → /forbidden', async () => {
    const response = await middleware(
      request('/users', signToken('ADMIN', { mod: 'dashboard' })),
    );
    expect(location(response)).toBe('/forbidden');
  });

  it('/settings/roles sin roles.manage → /forbidden', async () => {
    const response = await middleware(
      request('/settings/roles', signToken('IT', { mod: 'settings' })),
    );
    expect(location(response)).toBe('/forbidden');
  });

  it('/settings/permisos requiere módulo users (platform) en JWT', async () => {
    const withoutUsers = await middleware(
      request('/settings/permisos', signToken('ADMIN', { mod: 'dashboard' })),
    );
    expect(location(withoutUsers)).toBe('/forbidden');

    const withUsers = await middleware(
      request('/settings/permisos', signToken('ADMIN', { mod: 'users' })),
    );
    expect(withUsers.headers.get('location')).toBeNull();
    expect(withUsers.status).toBe(200);
  });

  it('mustChangePassword redirige a /settings/cambiar-contrasena salvo en esa ruta', async () => {
    const blocked = await middleware(
      request('/dashboard', signToken('ADMIN', { mod: 'dashboard', mustChangePassword: true })),
    );
    expect(location(blocked)).toBe('/settings/cambiar-contrasena');

    const allowed = await middleware(
      request(
        '/settings/cambiar-contrasena',
        signToken('ADMIN', { mod: 'dashboard', mustChangePassword: true }),
      ),
    );
    expect(allowed.headers.get('location')).toBeNull();
    expect(allowed.status).toBe(200);
  });

  const allowCases: { path: string; role: string; mod: string; spe?: string }[] = [
    { path: '/dashboard', role: 'ADMIN', mod: 'dashboard' },
    { path: '/users', role: 'ADMIN', mod: 'users' },
    { path: '/settings/roles', role: 'ADMIN', mod: 'settings', spe: 'roles.manage' },
    { path: '/planilla', role: 'HR', mod: 'payroll' },
    { path: '/planilla/configuracion', role: 'HR', mod: 'payroll' },
    { path: '/equipment', role: 'IT', mod: 'equipment' },
    { path: '/compras/ordenes', role: 'PROCUREMENT', mod: 'purchases' },
    { path: '/oficios/todos', role: 'SECRETARIA', mod: 'oficios' },
    { path: '/ti/licencias', role: 'IT', mod: 'software-licenses' },
  ];

  for (const { path, role, mod, spe } of allowCases) {
    it(`permite ${path} con mod=${mod}${spe ? ` spe=${spe}` : ''}`, async () => {
      const response = await middleware(request(path, signToken(role, { mod, spe })));
      expect(response.headers.get('location')).toBeNull();
      expect(response.status).toBe(200);
    });
  }
});
