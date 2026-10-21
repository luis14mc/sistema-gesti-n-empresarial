import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { refreshSession } from '@/modules/users/application/refresh-session-service';
import { usersDomainErrorResponse } from '@/modules/users/presentation/http';
import { generateSessionToken } from '@/lib/session-token';

async function postHandler(req: AuthenticatedRequest) {
  try {
    const session = await refreshSession({ userId: req.user!.userId });
    const token = await generateSessionToken({
      userId: req.user!.userId,
      email: session.email,
      role: session.sessionRole,
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
  } catch (error) {
    const domain = usersDomainErrorResponse(error);
    if (domain) return domain;
    return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
  }
}

export const POST = withAuth(postHandler);
