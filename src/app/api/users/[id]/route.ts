import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import {
  deleteUserByIdUseCase,
  getUserByIdUseCase,
  patchUserByIdUseCase,
} from '@/modules/users/application/user-detail-service';
import { handleUsersApiError } from '@/modules/users/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { parseOrganizationRole } from '@/platform/security/authorization/user-account-roles';

/**
 * DELETE searchParams.get('hard') === 'true' → countBlockingUserReferences; 409 «Tiene historial; desactívelo en su lugar».
 */
async function getHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await ctx.params;
    const { organizationId } = await authorizeOrganization(req, requestId, 'users.read');
    const result = await getUserByIdUseCase(organizationId, id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return handleUsersApiError(error, requestId, 'Error al obtener usuario');
  }
}

async function patchHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { organizationId } = await authorizeOrganization(req, requestId, 'users.update');
    if (body.role) {
      const parsedRole = parseOrganizationRole(String(body.role));
      if (parsedRole) {
        await authorizeOrganization(req, requestId, 'memberships.manage');
      }
    }
    const result = await patchUserByIdUseCase({
      organizationId,
      actorUserId: req.user!.userId,
      targetUserId: id,
      body,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return handleUsersApiError(error, requestId, 'Error al actualizar usuario');
  }
}

async function deleteHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const hard = searchParams.get('hard') === 'true';
    const { organizationId } = await authorizeOrganization(req, requestId, 'users.deactivate');
    const result = await deleteUserByIdUseCase({
      organizationId,
      actorUserId: req.user!.userId,
      targetUserId: id,
      hard,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return handleUsersApiError(error, requestId, 'Error al eliminar usuario');
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
