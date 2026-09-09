import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { middleware } from '@/middleware';

const TEST_SECRET = 'a'.repeat(48);

function signToken(role: string) {
  return jwt.sign(
    { userId: 'user-1', email: 'user@cni.hn', role, jti: 'jti-1' },
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

describe('Next.js middleware redirects', () => {
  let previousSecret: string | undefined;

  beforeEach(() => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('GET / without token redirects to /login', async () => {
    const response = await middleware(request('/'));
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(location(response)).toBe('/login');
  });

  it('GET / with a valid ADMIN token redirects to /dashboard', async () => {
    const response = await middleware(request('/', signToken('ADMIN')));
    expect(location(response)).toBe('/dashboard');
  });

  it('GET / with a valid SECRETARIA token redirects to /oficios/todos', async () => {
    const response = await middleware(request('/', signToken('SECRETARIA')));
    expect(location(response)).toBe('/oficios/todos');
  });

  it('GET / with an invalid token redirects to /login', async () => {
    const response = await middleware(request('/', 'not-a-valid-jwt'));
    expect(location(response)).toBe('/login');
  });

  it('GET /login with an invalid token stays on the login page', async () => {
    const response = await middleware(request('/login', 'not-a-valid-jwt'));
    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(200);
  });

  it('GET /login with a valid ADMIN token redirects to /dashboard', async () => {
    const response = await middleware(request('/login', signToken('ADMIN')));
    expect(location(response)).toBe('/dashboard');
  });
});
