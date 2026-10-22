import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { hashPassword } from '@/platform/security/authentication/auth';
import {
  createUser,
  listUsers,
  patchUserCollection,
} from '@/modules/users/application/users-collection-service';
import { handleUsersApiError } from '@/modules/users/presentation/http';
import { createUserBodySchema } from '@/modules/users/presentation/schemas/users';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { parseOrganizationRole } from '@/platform/security/authorization/user-account-roles';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'users.read');
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '100');
    const result = await listUsers({
      organizationId,
      query: {
        role: searchParams.get('role'),
        search: searchParams.get('search'),
        isActive: searchParams.get('isActive'),
        page,
        pageSize,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return handleUsersApiError(error, requestId, 'Error al obtener usuarios');
  }
}

async function patchHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const body = await req.json();
    const { id, confirmSelfRoleDemotion, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    const { organizationId } = await authorizeOrganization(req, requestId, 'users.update');
    if (data.role) {
      const parsedRole = parseOrganizationRole(String(data.role));
      if (parsedRole) {
        await authorizeOrganization(req, requestId, 'memberships.manage');
      }
    }

    const result = await patchUserCollection({
      organizationId,
      actorUserId: req.user!.userId,
      targetUserId: id,
      confirmSelfRoleDemotion,
      data,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return handleUsersApiError(error, requestId, 'Error al actualizar usuario');
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'users.create');
    const parsedBody = createUserBodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 },
      );
    }
    await authorizeOrganization(req, requestId, 'memberships.manage');

    const result = await createUser({
      organizationId,
      actorUserId: req.user!.userId,
      input: parsedBody.data,
      hashPassword,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return handleUsersApiError(error, requestId, 'Error al crear usuario');
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
export const PATCH = withAuth(patchHandler);
