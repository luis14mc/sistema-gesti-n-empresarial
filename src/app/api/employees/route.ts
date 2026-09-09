import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { Prisma } from '@prisma/client';
import { toEmployeeCreateData, validateHireDate } from '@/lib/employees';
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
    const search = searchParams.get('search');
    const departmentId = searchParams.get('departmentId');
    const isActive = searchParams.get('isActive');
    const positionId = searchParams.get('positionId');
    const hireDateFrom = searchParams.get('hireDateFrom');
    const hireDateTo = searchParams.get('hireDateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '20', 10) || 20, 1), 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.EmployeeWhereInput = { organizationId };
    if (departmentId) where.departmentId = departmentId;
    if (positionId) where.positionId = positionId;
    if (isActive !== null && isActive !== '') where.isActive = isActive === 'true';
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
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: pageSize,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          email: true,
          employeeCode: true,
          hireDate: true,
          isActive: true,
          department: { select: { id: true, name: true } },
          position: { select: { id: true, name: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      prisma.employee.count({ where }),
    ]);
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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const status = ['P1001', 'P1002', 'P2024'].includes(error.code) ? 503 : 500;
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
    const { firstName, lastName, email, employeeCode, hireDate, departmentId, positionId } = body;

    if (!firstName || !lastName || !email || !employeeCode || !hireDate || !departmentId || !positionId) {
      return NextResponse.json(
        { error: 'Nombre, apellido y correo son requeridos' },
        { status: 400 }
      );
    }
    if (!/^\S+@\S+\.\S+$/.test(String(email))) {
      return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
    }

    let hireDateValue: Date;
    try {
      hireDateValue = validateHireDate(hireDate);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error && error.message === 'FECHA_INGRESO_FUTURA' ? 'La fecha de ingreso no puede ser futura' : 'Fecha de ingreso inválida' }, { status: 400 });
    }
    const [department, position] = await Promise.all([
      prisma.department.findFirst({ where: { id: departmentId, organizationId, isActive: true } }),
      prisma.jobPosition.findFirst({ where: { id: positionId, department: { organizationId }, isActive: true } }),
    ]);
    if (!department || !position || position.departmentId !== department.id) {
      return NextResponse.json({ error: 'Departamento o puesto inválido' }, { status: 400 });
    }

    const employee = await prisma.employee.create({
      data: toEmployeeCreateData({ ...body, organizationId, hireDate: hireDateValue.toISOString().slice(0, 10) }),
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
      },
    });

    await createAuditRecord({
      title: 'Creación de empleado',
      description: `Se registró empleado: ${employee.fullName}`,
      module: 'EQUIPOS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: employee.id,
      organizationId,
      newData: { email: employee.email, fullName: employee.fullName },
    });

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    console.error('Error al crear empleado:', error);
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (isOrganizationContextError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Correo o código de empleado ya registrado en esta organización' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error al crear empleado' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
