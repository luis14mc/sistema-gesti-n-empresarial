import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { withAuth, AuthenticatedRequest } from '@/platform/api/with-auth';
import {
  createEmployee,
  listEmployeesPage,
  persistenceErrorCode,
  resolveEmployeeListOrderBy,
} from '@/modules/people/application/employees-service';
import { DomainError } from '@/platform/domain/errors';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { PermissionDeniedError } from '@/platform/domain/errors';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  try {
    const contextStartedAt = performance.now();
    const { organizationId } = await authorizeOrganization(req, requestId, 'employees.read');
    const contextMs = performance.now() - contextStartedAt;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limitParam = searchParams.get('limit');
    const pageSize = Math.min(
      Math.max(
        parseInt(searchParams.get('pageSize') || limitParam || '20', 10) || 20,
        1,
      ),
      100,
    );
    const skip = (page - 1) * pageSize;

    const search = searchParams.get('search');
    const departmentId = searchParams.get('departmentId');
    const isActive = searchParams.get('isActive');
    const status = searchParams.get('status');
    const positionId = searchParams.get('positionId');
    const sortBy = searchParams.get('sortBy') ?? searchParams.get('sort');
    const sortDir = searchParams.get('sortDir');
    const hireDateFrom = searchParams.get('hireDateFrom');
    const hireDateTo = searchParams.get('hireDateTo');

    const where: Prisma.EmployeeWhereInput = { organizationId };
    if (departmentId) where.departmentId = departmentId;
    if (positionId) where.positionId = positionId;
    if (status === 'inactive') {
      where.isActive = false;
    } else if (status === 'all') {
      // sin filtro de estado
    } else if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true';
    } else {
      where.isActive = true;
    }
    if (hireDateFrom || hireDateTo) where.hireDate = { gte: hireDateFrom ? new Date(`${hireDateFrom}T00:00:00.000Z`) : undefined, lte: hireDateTo ? new Date(`${hireDateTo}T00:00:00.000Z`) : undefined };
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { dni: { contains: search, mode: 'insensitive' } },
      ];
    }

    const databaseStartedAt = performance.now();
    const orderBy = resolveEmployeeListOrderBy(sortBy, sortDir);
    const [employees, total] = await listEmployeesPage(where, skip, pageSize, orderBy);
    const databaseMs = performance.now() - databaseStartedAt;
    if (process.env.NODE_ENV !== 'production') {
      console.info('[employees.list.timing]', { requestId, contextMs, databaseMs, totalMs: performance.now() - startedAt });
    }

    return NextResponse.json({
      employees,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error al obtener empleados:', { requestId, error });
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ success: false, error: { code: error.code, message: error.message }, requestId }, { status: 403, headers: { 'x-request-id': requestId } });
    }
    if (isOrganizationContextError(error)) {
      return NextResponse.json({ success: false, error: { code: error.code, message: error.message }, requestId }, { status: error.status, headers: { 'x-request-id': requestId } });
    }
    const prismaCode = persistenceErrorCode(error);
    if (prismaCode) {
      const status = ['P1001', 'P1002', 'P2024'].includes(prismaCode) ? 503 : 500;
      return NextResponse.json({ success: false, error: { code: 'EMPLOYEES_DATABASE_ERROR', message: status === 503 ? 'La base de datos no está disponible.' : 'No se pudo cargar el personal.' }, requestId }, { status, headers: { 'x-request-id': requestId } });
    }
    return NextResponse.json({ success: false, error: { code: 'EMPLOYEES_LIST_FAILED', message: 'No se pudo cargar el personal.' }, requestId }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'employees.create');
    const body = await req.json();
    const result = await createEmployee(organizationId, body, req.user!.userId);
    if (result.kind !== 'ok') {
      return NextResponse.json({ error: result.kind === 'invalid' ? result.error : 'Empleado no encontrado' }, { status: 400 });
    }
    const { employee } = result;

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    console.error('Error al crear empleado:', error);
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (isOrganizationContextError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error: error.message, code: error.code, ...(error.details ?? {}) },
        { status: error.httpStatus },
      );
    }
    if (persistenceErrorCode(error) === 'P2002') {
      return NextResponse.json({ error: 'Correo o código de empleado ya registrado en esta organización' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error al crear empleado' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
