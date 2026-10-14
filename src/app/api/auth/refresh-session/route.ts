import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { generateSessionToken } from '@/lib/session-token';
import { resolveSessionRole } from '@/platform/security/authorization/session-role';
import { prisma } from '@/lib/prisma';

async function postHandler(req: AuthenticatedRequest) {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, isActive: true },
  });
  if (!user?.isActive) {
    return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
  }

  const sessionRole = await resolveSessionRole(userId, user.role);
  const token = await generateSessionToken({
    userId,
    email: user.email,
    role: sessionRole,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60,
    path: '/',
  });
  return res;
}

export const POST = withAuth(postHandler);
