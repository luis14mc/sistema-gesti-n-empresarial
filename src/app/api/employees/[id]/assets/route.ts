import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/platform/api/with-auth';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { getEmployeeActiveAssets } from '@/modules/people/application/employees-service';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { isOrganizationContextError } from '@/modules/organizations/application/context';

async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.read');
    const result = await getEmployeeActiveAssets(organizationId, id);
    if (!result) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al obtener activos del empleado:', error);
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (isOrganizationContextError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error al obtener activos del empleado' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
