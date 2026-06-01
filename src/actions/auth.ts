'use server';

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { comparePassword, generateToken, hashPassword } from '@/lib/auth';
import { loginSchema, registerSchema } from '@/lib/zod-schemas';
import { createAuditRecord } from '@/lib/audit';
import type { ActionResult, SessionUser } from '@/types';

const COOKIE_NAME = 'token';
const COOKIE_MAX_AGE = 60 * 60; // 1 hora

const sessionSelect = {
  id: true,
  employeeNumber: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  departmentId: true,
  positionId: true,
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
} as const;

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

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...sessionSelect, password: true },
  });

  if (!user) {
    return { success: false, error: 'Credenciales inválidas' };
  }

  if (!user.isActive) {
    return { success: false, error: 'Tu cuenta está desactivada. Contacta al administrador.' };
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    return { success: false, error: 'Credenciales inválidas' };
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  await setAuthCookie(token);

  await createAuditRecord({
    title: 'Inicio de sesión',
    description: `${user.firstName} ${user.lastName} inició sesión`,
    module: 'USUARIOS',
    category: 'LOGIN',
    userId: user.id,
  });

  const { password: _, ...sessionUser } = user;
  return { success: true, data: sessionUser as unknown as SessionUser };
}

// ── REGISTER ──────────────────────────────────────────────────

import { requireRole } from '@/lib/session';

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

  const { employeeNumber, email, password, firstName, lastName } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { employeeNumber }] },
  });

  if (existing) {
    const field = existing.email === email ? 'email' : 'número de empleado';
    return { success: false, error: `Ya existe un usuario con ese ${field}` };
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: { employeeNumber, email, password: hashedPassword, firstName, lastName, role: 'USER' },
    select: sessionSelect,
  });

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  await setAuthCookie(token);

  return { success: true, data: user as unknown as SessionUser };
}

// ── LOGOUT ────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
}
