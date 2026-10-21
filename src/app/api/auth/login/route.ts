import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/lib/zod-schemas';
import { createHash } from 'node:crypto';
import {
  createRateLimiter,
  RATE_LIMIT_RULES,
  getClientIp,
  rateLimitHeaders,
} from '@/platform/security/authentication/rate-limit';
import {
  auditLoginRateLimit,
  delayRejectedLogin,
  loginWithApiCredentials,
  type LoginStage,
} from '@/modules/auth/application/login';

// Limiter por proceso (Edge-friendly). En producción multi-worker,
// reemplazar por Upstash Redis o equivalente distribuido.
const loginLimiter = createRateLimiter(RATE_LIMIT_RULES.LOGIN);
// Segundo límite por cuenta: acota la fuerza bruta contra un usuario aunque
// la clave por IP se evada (auditoría 2026-10-19, F-1).
const loginAccountLimiter = createRateLimiter(RATE_LIMIT_RULES.LOGIN_ACCOUNT);

function accountKey(email: string): string {
  return `acct:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`;
}

export async function POST(req: NextRequest) {
  // Rate limit por IP — antes de cualquier trabajo
  const ip = getClientIp(req);
  const limitResult = loginLimiter.check(ip);
  const headers = rateLimitHeaders(limitResult);

  if (!limitResult.success) {
    await auditLoginRateLimit('Rate limit excedido en login', `IP ${ip} bloqueada porRateLimit`);

    return NextResponse.json(
      {
        error: 'Demasiados intentos. Intenta más tarde.',
        retryAfterMs: limitResult.resetMs,
      },
      {
        status: 429,
        headers: {
          ...headers,
          'Retry-After': String(Math.ceil(limitResult.resetMs / 1000)),
        },
      }
    );
  }

  const progress: { stage: LoginStage } = { stage: 'LOOKUP_USER' };
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      await delayRejectedLogin();
      return NextResponse.json(
        { error: 'Datos de acceso inválidos' },
        { status: 400, headers }
      );
    }

    const { email, password } = parsed.data;

    const accountLimit = loginAccountLimiter.check(accountKey(email));
    if (!accountLimit.success) {
      await auditLoginRateLimit(
        'Rate limit por cuenta excedido en login',
        `Demasiados intentos para una cuenta desde IP ${ip}`,
      );
      return NextResponse.json(
        {
          error: 'Demasiados intentos para esta cuenta. Intenta más tarde.',
          retryAfterMs: accountLimit.resetMs,
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders(accountLimit),
            'Retry-After': String(Math.ceil(accountLimit.resetMs / 1000)),
          },
        },
      );
    }

    const result = await loginWithApiCredentials({ email, password, ip }, progress);

    if (result.kind === 'invalid-credentials') {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401, headers }
      );
    }

    if (result.kind === 'inactive') {
      return NextResponse.json(
        { error: 'Usuario inactivo' },
        { status: 403, headers }
      );
    }

    return NextResponse.json(
      { user: { ...result.user, role: result.sessionRole }, token: result.token },
      { status: 200, headers }
    );
  } catch (error) {
    console.error('[Login] Error', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      stage: progress.stage,
    });
    return NextResponse.json(
      { error: 'Error al iniciar sesión' },
      { status: 500, headers }
    );
  }
}
