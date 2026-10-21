import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { listDepartments } from '@/modules/people/application/employees-service';
import { handlePrismaRouteError } from '@/modules/purchases/presentation/http';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { organizationId } = await authorizeOrganization(req, crypto.randomUUID(), 'employees.read');
    const departments = await listDepartments(organizationId);

    return NextResponse.json({ departments });
  } catch (error) {
    return handlePrismaRouteError(error, 'GET /api/departments');
  }
}

export const GET = withAuth(getHandler);
