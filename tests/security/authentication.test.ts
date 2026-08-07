// Phase 10C — authentication regression tests.
//
// These tests focus on the JWT helpers, the password primitives, and the
// middleware path. Database-backed tests (login endpoint, password change
// revocation, MFA flow) are documented in
// docs/testing/security-regression.md and are exercised end-to-end via
// the live-database integration tests in tests/integration.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, comparePassword, generateToken, verifyToken } from '@/lib/auth';
import type { AuthenticatedRequest } from '@/lib/middleware';
import type { NextResponse } from 'next/server';

const TEST_SECRET = 'a'.repeat(48);

describe('password primitives', () => {
  it('produces a bcrypt hash that is not the plaintext', async () => {
    const hashed = await hashPassword('PlainPassword!23');
    expect(hashed).not.toBe('PlainPassword!23');
    expect(hashed.startsWith('$2')).toBe(true);
  });

  it('verifies the correct password', async () => {
    const hashed = await hashPassword('PlainPassword!23');
    expect(await comparePassword('PlainPassword!23', hashed)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hashed = await hashPassword('PlainPassword!23');
    expect(await comparePassword('OtherPassword!23', hashed)).toBe(false);
  });

  it('rejects an empty password', async () => {
    const hashed = await hashPassword('PlainPassword!23');
    expect(await comparePassword('', hashed)).toBe(false);
  });

  it('rejects a password that is too long to be a valid bcrypt input', async () => {
    const hashed = await hashPassword('PlainPassword!23');
    const tooLong = 'a'.repeat(80);
    expect(await comparePassword(tooLong, hashed)).toBe(false);
  });
});

describe('JWT helpers', () => {
  let previousSecret: string | undefined;
  beforeEach(() => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
  });
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('round-trips a valid payload', () => {
    const token = generateToken({ userId: 'u-1', email: 'u@example.test', role: 'ADMIN' });
    const decoded = verifyToken(token);
    expect(decoded).toMatchObject({ userId: 'u-1', email: 'u@example.test', role: 'ADMIN' });
  });

  it('returns null for a token signed with a different secret', () => {
    const previousSecret2 = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'b'.repeat(48);
    const token = generateToken({ userId: 'u-1', email: 'u@example.test', role: 'ADMIN' });
    process.env.JWT_SECRET = TEST_SECRET;
    expect(verifyToken(token)).toBeNull();
    if (previousSecret2 === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret2;
  });

  it('returns null for a malformed token', () => {
    expect(verifyToken('not-a-jwt')).toBeNull();
  });

  it('returns null for an empty token', () => {
    expect(verifyToken('')).toBeNull();
  });

  it('throws when JWT_SECRET is missing', () => {
    const previousSecret2 = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => generateToken({ userId: 'u-1', email: 'u@example.test', role: 'ADMIN' }))
      .toThrow(/JWT_SECRET/);
    if (previousSecret2 === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret2;
  });

  it('throws when JWT_SECRET is shorter than the minimum length', () => {
    const previousSecret2 = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'short';
    expect(() => generateToken({ userId: 'u-1', email: 'u@example.test', role: 'ADMIN' }))
      .toThrow(/al menos 32/);
    if (previousSecret2 === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret2;
  });

  it('rejects an expired token', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const token = jwt.sign(
      { userId: 'u-1', email: 'u@example.test', role: 'ADMIN' },
      TEST_SECRET,
      { expiresIn: -1 },
    );
    expect(verifyToken(token)).toBeNull();
  });
});

describe('middleware behavior — auth envelope', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('withAuth returns AUTHENTICATION_REQUIRED with the standard envelope when no token', async () => {
    const { withAuth } = await import('@/lib/middleware');
    const handler = withAuth(async () => new Response('ok') as unknown as NextResponse);
    const response = await handler({ headers: new Headers(), cookies: { get: () => undefined }, user: undefined } as never);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      error: { code: 'AUTHENTICATION_REQUIRED' },
    });
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get('x-request-id')).toBe(body.requestId);
  });

  it('withAuth validates the role allowlist and returns FORBIDDEN when missing', async () => {
    const { withAuth } = await import('@/lib/middleware');
    const handler = withAuth(async () => new Response('ok') as unknown as NextResponse, ['ADMIN']);
    const token = generateToken({ userId: 'u-1', email: 'u@example.test', role: 'USER' });
    const response = await handler({
      headers: new Headers({ authorization: `Bearer ${token}` }),
      cookies: { get: () => undefined },
      user: undefined,
    } as never);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
  });

  it('withAuth accepts a cookie token when the authorization header is absent', async () => {
    const { withAuth } = await import('@/lib/middleware');
    const handler = withAuth(async () => new Response('ok') as unknown as NextResponse);
    const token = generateToken({ userId: 'u-1', email: 'u@example.test', role: 'ADMIN' });
    const response = await handler({
      headers: new Headers(),
      cookies: { get: (name: string) => (name === 'token' ? { value: token } : undefined) },
      user: undefined,
    } as never);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe('ok');
  });

  it('withAuth rejects a "Bearer none" token as AUTHENTICATION_REQUIRED', async () => {
    const { withAuth } = await import('@/lib/middleware');
    const handler = withAuth(async () => new Response('ok') as unknown as NextResponse);
    const response = await handler({
      headers: new Headers({ authorization: 'Bearer none' }),
      cookies: { get: () => undefined },
      user: undefined,
    } as never);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      error: { code: 'AUTHENTICATION_REQUIRED' },
    });
  });

  it('withAuth exposes an authenticated user on the request when the token is valid', async () => {
    const { withAuth } = await import('@/lib/middleware');
    let capturedRole: string | undefined;
    const handler = withAuth(async (req: AuthenticatedRequest) => {
      capturedRole = req.user?.role;
      return new Response('ok') as unknown as NextResponse;
    });
    const token = generateToken({ userId: 'u-7', email: 'u@example.test', role: 'ADMIN' });
    const response = await handler({
      headers: new Headers({ authorization: `Bearer ${token}` }),
      cookies: { get: () => undefined },
      user: undefined,
    } as never);
    expect(response.status).toBe(200);
    expect(capturedRole).toBe('ADMIN');
  });
});
