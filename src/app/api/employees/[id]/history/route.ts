import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { getEmployeeAuditHistory } from '@/modules/people/application/employees-service';
import { findEmployee } from '@/modules/people/infrastructure/employee-repository';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { isOrganizationContextError } from '@/modules/organizations/application/context';

async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const { organizationId } = await authorizeOrganization(req, requestId, 'employees.read');
    const employee = await findEmployee(organizationId, id);
    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '20', 10) || 20, 1), 100);
    const skip = (page - 1) * pageSize;
    const [records, total] = await getEmployeeAuditHistory(organizationId, id, skip, pageSize);
    return NextResponse.json({
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error al obtener historial del empleado:', error);
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (isOrganizationContextError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
