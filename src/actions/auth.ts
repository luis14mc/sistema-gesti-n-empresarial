'use server';

import { cookies } from 'next/headers';
import { loginSchema, registerSchema } from '@/lib/zod-schemas';
import { requireRole } from '@/platform/security/authentication/session';
import { auditSessionLogin, loginWithSessionCredentials } from '@/modules/auth/application/login';
import { registerUserWithSession } from '@/modules/auth/application/register';
import type { ActionResult, SessionUser } from '@/types';

const COOKIE_NAME = 'token';
const COOKIE_MAX_AGE = 60 * 60; // 1 hora

async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

// ── LOGIN ─────────────────────────────────────────────────────

export async function loginAction(
  input: { email: string; password: string }
): Promise<ActionResult<SessionUser>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Datos de entrada inválidos' };
  }

  const result = await loginWithSessionCredentials(parsed.data);
  if (result.kind === 'invalid-credentials') {
    return { success: false, error: 'Credenciales inválidas' };
  }
  if (result.kind === 'inactive') {
    return { success: false, error: 'Tu cuenta está desactivada. Contacta al administrador.' };
  }

  await setAuthCookie(result.token);
  await auditSessionLogin(result.user);

  return { success: true, data: { ...result.user, role: result.sessionRole } as unknown as SessionUser };
}

// ── REGISTER ──────────────────────────────────────────────────

export async function registerAction(
  input: {
    employeeNumber: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }
): Promise<ActionResult<SessionUser>> {
  // Asegurar RBAC en la acción de servidor
  await requireRole('ADMIN', 'RRHH');

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as string;
      fieldErrors[key] = fieldErrors[key] || [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, error: 'Datos inválidos', fieldErrors };
  }

  const result = await registerUserWithSession(parsed.data);
  if (result.kind === 'duplicate') {
    return { success: false, error: `Ya existe un usuario con ese ${result.field}` };
  }

  await setAuthCookie(result.token);

  return { success: true, data: result.user as unknown as SessionUser };
}

// ── LOGOUT ────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
}
