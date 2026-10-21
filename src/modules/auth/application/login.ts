import { comparePassword } from '@/platform/security/authentication/auth';
import { generateSessionToken } from '@/platform/security/authentication/session-token';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { resolveSessionRole } from '@/platform/security/authorization/session-role';
import {
  findSessionUserWithPasswordByEmail,
  findUserByEmail,
} from '@/modules/auth/infrastructure/credentials-repository';

const FAILED_ATTEMPT_DELAY_MS = 500;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function logLoginAuditFailure(userId: string, error: unknown) {
  console.error('[Login] audit failed', {
    userId,
    error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
  });
}

export type LoginStage = 'LOOKUP_USER' | 'VERIFY_PASSWORD' | 'RESOLVE_SESSION_ROLE' | 'GENERATE_TOKEN' | 'AUDIT_LOGIN';

export type ApiLoginResult =
  | { kind: 'invalid-credentials' }
  | { kind: 'inactive' }
  | {
      kind: 'ok';
      user: Omit<NonNullable<Awaited<ReturnType<typeof findUserByEmail>>>, 'password'>;
      sessionRole: string;
      token: string;
    };

/**
 * Login por API (Bearer + JSON). `progress.stage` se actualiza para que el
 * controlador registre en qué etapa falló una excepción.
 */
export async function loginWithApiCredentials(
  input: { email: string; password: string; ip: string },
  progress: { stage: LoginStage },
): Promise<ApiLoginResult> {
  const { email, password, ip } = input;
  const user = await findUserByEmail(email);

  if (!user) {
    await delay(FAILED_ATTEMPT_DELAY_MS);
    return { kind: 'invalid-credentials' };
  }

  if (!user.isActive) {
    await delay(FAILED_ATTEMPT_DELAY_MS);
    return { kind: 'inactive' };
  }

  progress.stage = 'VERIFY_PASSWORD';
  const isPasswordValid = await comparePassword(password, user.password);

  if (!isPasswordValid) {
    await delay(FAILED_ATTEMPT_DELAY_MS);
    await createAuditRecord({
      title: 'Intento de login fallido',
      description: `Password incorrecto para ${email} desde ${ip}`,
      module: 'USUARIOS',
      category: 'LOGIN',
    }).catch(() => undefined);
    return { kind: 'invalid-credentials' };
  }

  progress.stage = 'RESOLVE_SESSION_ROLE';
  const sessionRole = await resolveSessionRole(user.id, user.role);

  progress.stage = 'GENERATE_TOKEN';
  const token = await generateSessionToken({
    userId: user.id,
    email: user.email,
    role: sessionRole,
  });

  const { password: _omit, ...userWithoutPassword } = user;

  progress.stage = 'AUDIT_LOGIN';
  await createAuditRecord({
    title: 'Inicio de sesión (API)',
    description: `${user.firstName} ${user.lastName} inició sesión`,
    module: 'USUARIOS',
    category: 'LOGIN',
    userId: user.id,
  }).catch((error) => logLoginAuditFailure(user.id, error));

  return { kind: 'ok', user: userWithoutPassword, sessionRole, token };
}

export async function delayRejectedLogin(): Promise<void> {
  await delay(FAILED_ATTEMPT_DELAY_MS);
}

export async function auditLoginRateLimit(title: string, description: string): Promise<void> {
  await createAuditRecord({
    title,
    description,
    module: 'USUARIOS',
    category: 'LOGIN',
  }).catch(() => undefined);
}

export type SessionLoginResult =
  | { kind: 'invalid-credentials' }
  | { kind: 'inactive' }
  | {
      kind: 'ok';
      user: Omit<NonNullable<Awaited<ReturnType<typeof findSessionUserWithPasswordByEmail>>>, 'password'>;
      sessionRole: string;
      token: string;
    };

/** Login por server action (cookie). El adaptador fija la cookie con `token`. */
export async function loginWithSessionCredentials(input: {
  email: string;
  password: string;
}): Promise<SessionLoginResult> {
  const user = await findSessionUserWithPasswordByEmail(input.email);

  if (!user) return { kind: 'invalid-credentials' };
  if (!user.isActive) return { kind: 'inactive' };

  const valid = await comparePassword(input.password, user.password);
  if (!valid) return { kind: 'invalid-credentials' };

  const sessionRole = await resolveSessionRole(user.id, user.role);
  const token = await generateSessionToken({
    userId: user.id,
    email: user.email,
    role: sessionRole,
  });

  return { kind: 'ok', user: stripPassword(user), sessionRole, token };
}

/** Se ejecuta después de fijar la cookie, igual que el flujo original. */
export async function auditSessionLogin(user: { id: string; firstName: string; lastName: string }): Promise<void> {
  await createAuditRecord({
    title: 'Inicio de sesión',
    description: `${user.firstName} ${user.lastName} inició sesión`,
    module: 'USUARIOS',
    category: 'LOGIN',
    userId: user.id,
  }).catch((error) => logLoginAuditFailure(user.id, error));
}

function stripPassword<T extends { password: string }>(user: T): Omit<T, 'password'> {
  const { password: _, ...rest } = user;
  return rest;
}
