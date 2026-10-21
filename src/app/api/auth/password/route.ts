import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { comparePassword, hashPassword } from '@/platform/security/authentication/auth';
import { changeOwnPassword } from '@/modules/users/application/change-password-service';
import { usersDomainErrorResponse } from '@/modules/users/presentation/http';
import { changePasswordSchema } from '@/modules/users/presentation/schemas/users';
import { generateSessionToken } from '@/platform/security/authentication/session-token';
import { resolveSessionRole } from '@/platform/security/authorization/session-role';
import { canonicalOrganizationId } from '@/platform/security/organization-scope';

async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = changePasswordSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json(
        { error: body.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 },
      );
    }

    const changed = await changeOwnPassword({
      userId: req.user!.userId,
      organizationId: canonicalOrganizationId(),
      currentPassword: body.data.currentPassword,
      newPassword: body.data.newPassword,
      comparePassword,
      hashPassword,
    });

    const sessionRole = await resolveSessionRole(changed.userId, changed.legacyRole);
    const token = await generateSessionToken({
      userId: changed.userId,
      email: changed.email,
      role: sessionRole,
    });
    const res = NextResponse.json({ success: true });
    res.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60,
      path: '/',
    });
    return res;
  } catch (error) {
    console.error('Error changing password:', error);
    const domain = usersDomainErrorResponse(error);
    if (domain) return domain;
    return NextResponse.json({ error: 'Error al cambiar contraseña' }, { status: 500 });
  }
}

export const POST = withAuth(postHandler);
