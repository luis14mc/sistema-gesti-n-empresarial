import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { z } from 'zod';
import {
  getRoleSettingsUseCase,
  putRoleSettingsUseCase,
} from '@/modules/users/application/role-settings-service';
import { handleUsersApiError } from '@/modules/users/presentation/http';
import { roleParamSchema, roleSettingsPutSchema } from '@/modules/users/presentation/schemas/users';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';

async function getHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ role: string }> }) {
  const requestId = crypto.randomUUID();
  const { role: roleRaw } = await ctx.params;
  const parsedRole = roleParamSchema.safeParse(roleRaw);
  if (!parsedRole.success) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }
  try {
    const context = await authorizeOrganization(req, requestId, 'roles.manage');
    const result = await getRoleSettingsUseCase({
      organizationId: context.organizationId,
      role: parsedRole.data,
    });
    return NextResponse.json(result);
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    console.error('GET role settings', error);
    return NextResponse.json({ error: 'Error al cargar configuración del rol' }, { status: 500 });
  }
}

async function putHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ role: string }> }) {
  const requestId = crypto.randomUUID();
  const { role: roleRaw } = await ctx.params;
  const parsedRole = roleParamSchema.safeParse(roleRaw);
  if (!parsedRole.success) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }

  let body;
  try {
    body = roleSettingsPutSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Payload inválido' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  try {
    const context = await authorizeOrganization(req, requestId, 'roles.manage');
    const result = await putRoleSettingsUseCase({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      role: parsedRole.data,
      body,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('PUT role settings', error);
    return handleUsersApiError(error, requestId, 'Error al guardar configuración del rol');
  }
}

export const GET = withAuth(getHandler);
export const PUT = withAuth(putHandler);
