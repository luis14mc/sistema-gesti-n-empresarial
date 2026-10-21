import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { PermissionDeniedError } from '@/platform/domain/errors';
import {
  deleteUserPermissionOverridesUseCase,
  findActorMembershipRole,
  getUserPermissionOverridesUseCase,
  putUserPermissionOverridesUseCase,
} from '@/modules/users/application/user-permission-overrides-service';
import { usersDomainErrorResponse } from '@/modules/users/presentation/http';
import { userPermissionOverridesPutSchema } from '@/modules/users/presentation/schemas/users';
import { requireOrganizationPermission } from '@/platform/security/authorization/effective-permissions';
import { canonicalOrganizationId } from '@/platform/security/organization-scope';

async function getHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: targetUserId } = await ctx.params;
    const organizationId = canonicalOrganizationId();
    const actorId = req.user!.userId;
    const actorRole = await findActorMembershipRole(organizationId, actorId);
    await requireOrganizationPermission(actorId, organizationId, actorRole, 'users.read');

    const result = await getUserPermissionOverridesUseCase({ organizationId, targetUserId });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const domain = usersDomainErrorResponse(error);
    if (domain) return domain;
    return NextResponse.json({ error: 'Error al cargar permisos' }, { status: 500 });
  }
}

async function putHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: targetUserId } = await ctx.params;
    const organizationId = canonicalOrganizationId();
    const actorId = req.user!.userId;
    const actorRole = await findActorMembershipRole(organizationId, actorId);
    await requireOrganizationPermission(actorId, organizationId, actorRole, 'users.update');

    const parsed = userPermissionOverridesPutSchema.parse(await req.json());
    const result = await putUserPermissionOverridesUseCase({
      organizationId,
      actorUserId: actorId,
      targetUserId,
      body: parsed,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const domain = usersDomainErrorResponse(error);
    if (domain) return domain;
    return NextResponse.json({ error: 'Error al guardar permisos' }, { status: 500 });
  }
}

async function deleteHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: targetUserId } = await ctx.params;
    const organizationId = canonicalOrganizationId();
    const actorId = req.user!.userId;
    const actorRole = await findActorMembershipRole(organizationId, actorId);
    await requireOrganizationPermission(actorId, organizationId, actorRole, 'users.update');

    const result = await deleteUserPermissionOverridesUseCase({
      organizationId,
      actorUserId: actorId,
      targetUserId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const domain = usersDomainErrorResponse(error);
    if (domain) return domain;
    return NextResponse.json({ error: 'Error al eliminar permisos' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const PUT = withAuth(putHandler);
export const DELETE = withAuth(deleteHandler);
