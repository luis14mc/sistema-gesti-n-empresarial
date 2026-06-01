import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { verifyToken } from './auth';
import { prisma } from './prisma';
import type { SessionUser } from '@/types';

const SESSION_COOKIE = 'token';

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

/**
 * Lee la sesión actual desde la cookie HttpOnly.
 * Retorna null si no hay sesión válida.
 * Usa React `cache()` para deduplicar llamadas dentro del mismo request.
 */
export const getSession = cache(async (): Promise<{ user: SessionUser } | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId, isActive: true },
    select: sessionSelect,
  });

  if (!user) return null;
  return { user: user as unknown as SessionUser };
});

/**
 * Igual que getSession pero redirige a /login si no hay sesión.
 * Para usar en Server Components y Server Actions protegidos.
 */
export async function requireSession(): Promise<{ user: SessionUser }> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

/**
 * Requiere sesión + un rol específico. Redirige a /dashboard si el rol no coincide.
 */
export async function requireRole(...roles: SessionUser['role'][]): Promise<{ user: SessionUser }> {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) redirect('/dashboard');
  return session;
}
