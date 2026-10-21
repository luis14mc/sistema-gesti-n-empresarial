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

describe('middleware · cambio de contraseña obligatorio sin módulo dashboard', () => {
  let previousSecret: string | undefined;
  beforeEach(() => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
  });
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('SECRETARIA (sin dashboard en mod) puede abrir /settings/cambiar-contrasena', async () => {
    const response = await middleware(
      request('/settings/cambiar-contrasena', signToken('SECRETARIA', { mod: 'oficios', mustChangePassword: true })),
    );
    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(200);
  });

  it('con mustChangePassword, una ruta de un módulo NO permitido redirige al cambio (no a /forbidden)', async () => {
    const response = await middleware(
      request('/users', signToken('SECRETARIA', { mod: 'oficios', mustChangePassword: true })),
    );
    expect(location(response)).toBe('/settings/cambiar-contrasena');
  });

  it('sin mustChangePassword, SECRETARIA sigue sin acceso a /settings/cambiar-contrasena por módulo', async () => {
    const response = await middleware(
      request('/settings/cambiar-contrasena', signToken('SECRETARIA', { mod: 'oficios' })),
    );
    expect(location(response)).toBe('/forbidden');
  });
});
