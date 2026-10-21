import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { getProfile, patchProfile } from '@/modules/users/application/profile-service';
import { usersDomainErrorResponse } from '@/modules/users/presentation/http';
import { canonicalOrganizationId } from '@/platform/security/organization-scope';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const cookieToken = req.cookies.get('token')?.value;
    const claims = cookieToken ? verifyToken(cookieToken) : null;
    const result = await getProfile({
      userId: req.user!.userId,
      organizationId: canonicalOrganizationId(),
      tokenAccessVersion: claims?.accessVersion,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    const domain = usersDomainErrorResponse(error);
    if (domain) return domain;
    return NextResponse.json({ error: 'Error al obtener perfil' }, { status: 500 });
  }
}

async function patchHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();
    const result = await patchProfile({ userId: req.user!.userId, body });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    const domain = usersDomainErrorResponse(error);
    if (domain) return domain;
    return NextResponse.json({ error: 'Error al actualizar perfil' }, { status: 400 });
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
