import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, generateToken } from '@/lib/auth';
import { createAuditRecord } from '@/lib/audit';
import { loginSchema } from '@/lib/zod-schemas';
import {
  createRateLimiter,
  RATE_LIMIT_RULES,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limit';

// Limiter por proceso (Edge-friendly). En producción multi-worker,
// reemplazar por Upstash Redis o equivalente distribuido.
const loginLimiter = createRateLimiter(RATE_LIMIT_RULES.LOGIN);

// Delay artificial para mitigar fuerza bruta básica
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  // Rate limit por IP — antes de cualquier trabajo
  const ip = getClientIp(req);
  const limitResult = loginLimiter.check(ip);
  const headers = rateLimitHeaders(limitResult);

  if (!limitResult.success) {
    await createAuditRecord({
      title: 'Rate limit excedido en login',
      description: `IP ${ip} bloqueada porRateLimit`,
      module: 'USUARIOS',
      category: 'LOGIN',
    }).catch(() => undefined);

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

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      await delay(500);
      return NextResponse.json(
        { error: 'Datos de acceso inválidos' },
        { status: 400, headers }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      await delay(500);
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401, headers }
      );
    }

    if (!user.isActive) {
      await delay(500);
      return NextResponse.json(
        { error: 'Usuario inactivo' },
        { status: 403, headers }
      );
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      await delay(500);
      await createAuditRecord({
        title: 'Intento de login fallido',
        description: `Password incorrecto para ${email} desde ${ip}`,
        module: 'USUARIOS',
        category: 'LOGIN',
      }).catch(() => undefined);
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401, headers }
      );
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _omit, ...userWithoutPassword } = user;

    await createAuditRecord({
      title: 'Inicio de sesión (API)',
      description: `${user.firstName} ${user.lastName} inició sesión`,
      module: 'USUARIOS',
      category: 'LOGIN',
      userId: user.id,
    });

    return NextResponse.json(
      { user: userWithoutPassword, token },
      { status: 200, headers }
    );
  } catch (error) {
    console.error('[Login] Error:', error);
    return NextResponse.json(
      { error: 'Error al iniciar sesión' },
      { status: 500, headers }
    );
  }
}
