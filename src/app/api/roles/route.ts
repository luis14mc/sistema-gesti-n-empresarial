import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { getRoleCatalog } from '@/platform/security/authorization/role-catalog-service';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { searchParams } = new URL(req.url);
    const assignableOnly = searchParams.get('assignable') === 'true';
    const scopeLabels = searchParams.get('scope') === 'labels';

    const context = await authorizeOrganization(
      req,
      requestId,
      assignableOnly || scopeLabels ? 'users.read' : 'roles.manage',
    );

    const roles = await getRoleCatalog(context.organizationId, {
      assignableOnly: assignableOnly && !scopeLabels,
      includeModuleLabels: assignableOnly && !scopeLabels,
    });

    if (scopeLabels) {
      return NextResponse.json({
        roles: roles.map(({ role, displayName, assignable }) => ({
          role,
          displayName,
          assignable,
          label: displayName,
        })),
      });
    }

    return NextResponse.json({
      roles: roles.map((entry) => ({
        ...entry,
        label: entry.displayName,
      })),
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    console.error('GET /api/roles', error);
    return NextResponse.json({ error: 'Error al listar roles' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
