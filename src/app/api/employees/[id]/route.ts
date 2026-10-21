import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/platform/api/with-auth';
import { getEmployeeDetail, updateEmployeeFields } from '@/modules/people/application/employees-service';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { PermissionDeniedError } from '@/platform/domain/errors';
import type { Permission } from '@/platform/security/authorization/permissions';

function patchPermission(data: Record<string, unknown>): Permission {
  if (Object.prototype.hasOwnProperty.call(data, 'isActive')) return 'employees.deactivate';
  return 'employees.update';
}

async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const { organizationId } = await authorizeOrganization(req, requestId, 'employees.read');
    const employee = await getEmployeeDetail({ where: { id, organizationId } });

    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('Error al obtener empleado:', error);
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (isOrganizationContextError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error al obtener empleado' }, { status: 500 });
  }
}

async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const data = await req.json();
    const { organizationId } = await authorizeOrganization(req, requestId, patchPermission(data));
    const result = await updateEmployeeFields(organizationId, id, data, req.user!.userId);
    if (result.kind === 'not-found') return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    if (result.kind === 'invalid') return NextResponse.json({ error: result.error }, { status: 400 });
    const { employee } = result;

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('Error al actualizar empleado:', error);
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (isOrganizationContextError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error al actualizar empleado' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
