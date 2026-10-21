import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { resetRolePermissionsUseCase } from '@/modules/users/application/role-reset-service';
import { roleParamSchema } from '@/modules/users/presentation/schemas/users';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';

async function postHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ role: string }> }) {
  const requestId = crypto.randomUUID();
  const { role: roleRaw } = await ctx.params;
  const parsedRole = roleParamSchema.safeParse(roleRaw);
  if (!parsedRole.success) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }

  try {
    const context = await authorizeOrganization(req, requestId, 'roles.manage');
    const result = await resetRolePermissionsUseCase({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      role: parsedRole.data,
    });
    return NextResponse.json(result);
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    console.error('POST role reset', error);
    return NextResponse.json({ error: 'Error al restablecer rol' }, { status: 500 });
  }
}

export const POST = withAuth(postHandler);
