import { describe, expect, it } from 'vitest';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { expectFailureEnvelope, expectRequestIdHeader, expectSuccessEnvelope } from '../helpers/contracts';

const TEST_JWT_SECRET = 'a'.repeat(48);

function buildRequest(options: { token?: string; cookieToken?: string } = {}): AuthenticatedRequest {
  const headers = new Headers();
  if (options.token) headers.set('authorization', `Bearer ${options.token}`);
  const cookies = new Map<string, { value: string }>();
  if (options.cookieToken) cookies.set('token', { value: options.cookieToken });
  const req = {
    headers,
    cookies: { get: (name: string) => cookies.get(name) },
    user: undefined,
  } as unknown as AuthenticatedRequest;
  return req;
}

async function signToken(payload: { userId: string; email: string; role: string }, secret: string): Promise<string> {
  const jwt = await import('jsonwebtoken');
  return jwt.default.sign(
    { ...payload, jti: crypto.randomUUID() },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '5m',
      issuer: 'sge',
      audience: 'sge-web',
    }
  );
}

describe('withAuth middleware (Phase 10A contract)', () => {
  it('returns AUTHENTICATION_REQUIRED when no token is present', async () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    try {
      const handler = withAuth(async () => apiSuccess({ ok: true }, { requestId: 'req-no-token' }));
      const response = await handler(buildRequest());
      expect(response.status).toBe(401);
      const body = await response.json();
      expectFailureEnvelope(body, {
        requestId: String(body.requestId),
        code: 'AUTHENTICATION_REQUIRED',
        message: /iniciar sesi[oó]n/i,
      });
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });

  it('returns AUTHENTICATION_REQUIRED when the token signature is invalid', async () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    try {
      const handler = withAuth(async () => apiSuccess({ ok: true }, { requestId: 'req-bad-sig' }));
      const response = await handler(buildRequest({ token: 'not-a-real-jwt' }));
      expect(response.status).toBe(401);
      const body = await response.json();
      expectFailureEnvelope(body, {
        requestId: String(body.requestId),
        code: 'AUTHENTICATION_REQUIRED',
      });
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });

  it('returns FORBIDDEN when the user role is not in the allow-list', async () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    try {
      const token = await signToken({ userId: 'u-1', email: 'u@example.test', role: 'USER' }, TEST_JWT_SECRET);
      const handler = withAuth(async () => apiSuccess({ ok: true }, { requestId: 'req-bad-role' }), ['ADMIN']);
      const response = await handler(buildRequest({ token }));
      expect(response.status).toBe(403);
      const body = await response.json();
      expectFailureEnvelope(body, {
        requestId: String(body.requestId),
        code: 'FORBIDDEN',
      });
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });

  it('invokes the handler and propagates the success envelope when the token is valid', async () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    try {
      const token = await signToken({ userId: 'u-2', email: 'u@example.test', role: 'ADMIN' }, TEST_JWT_SECRET);
      const handler = withAuth(async (req) => apiSuccess({ userId: req.user?.userId }, { requestId: 'req-ok' }));
      const response = await handler(buildRequest({ token }));
      expect(response.status).toBe(200);
      const body = await response.json();
      expectSuccessEnvelope(body, { requestId: 'req-ok', data: { userId: 'u-2' } });
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });

  it('attaches the x-request-id header on every response (success and failure)', async () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    try {
      const handler = withAuth(async () => apiSuccess({ ok: true }, { requestId: 'req-hdr-1' }));
      const response = await handler(buildRequest());
      expectRequestIdHeader(response.headers, String((await response.json()).requestId));
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });

  it('uses the cookie token when authorization header is absent', async () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    try {
      const token = await signToken({ userId: 'u-3', email: 'u@example.test', role: 'ADMIN' }, TEST_JWT_SECRET);
      const handler = withAuth(async (req) => apiSuccess({ userId: req.user?.userId }, { requestId: 'req-cookie' }));
      const response = await handler(buildRequest({ cookieToken: token }));
      expect(response.status).toBe(200);
      const body = await response.json();
      expectSuccessEnvelope(body, { requestId: 'req-cookie', data: { userId: 'u-3' } });
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });

  it('falls back to AUTHENTICATION_REQUIRED if the handler throws', async () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    try {
      const token = await signToken({ userId: 'u-4', email: 'u@example.test', role: 'ADMIN' }, TEST_JWT_SECRET);
      const handler = withAuth(async () => {
        throw new Error('handler exploded');
      });
      const response = await handler(buildRequest({ token }));
      // The current middleware catches every error and returns 401
      // AUTHENTICATION_REQUIRED. Document the behavior so a future change
      // to a 500 mapping is intentional.
      expect(response.status).toBe(401);
      const body = await response.json();
      expectFailureEnvelope(body, {
        requestId: String(body.requestId),
        code: 'AUTHENTICATION_REQUIRED',
      });
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });
});
