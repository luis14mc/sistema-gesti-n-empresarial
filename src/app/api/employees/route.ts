import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { Prisma } from '@prisma/client';
import { buildFullName, toEmployeeCreateData } from '@/lib/employees';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const departmentId = searchParams.get('departmentId');
    const isActive = searchParams.get('isActive');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const skip = (page - 1) * pageSize;

    const where: Prisma.EmployeeWhereInput = {};
    if (departmentId) where.departmentId = departmentId;
    if (isActive !== null && isActive !== '') where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { dni: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          department: { select: { id: true, name: true } },
          position: { select: { id: true, name: true } },
          assignments: {
            where: { status: 'ACTIVE' },
            include: { equipment: { select: { id: true, inventoryCode: true, brand: true, model: true } } },
          },
        },
        orderBy: { fullName: 'asc' },
      }),
      prisma.employee.count({ where }),
    ]);

    return NextResponse.json({
      employees,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error al obtener empleados:', error);
    return NextResponse.json({ error: 'Error al obtener empleados' }, { status: 500 });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'Nombre, apellido y correo son requeridos' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: toEmployeeCreateData(body),
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
      newData: { email: employee.email, fullName: employee.fullName },
    });

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    console.error('Error al crear empleado:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Correo o código de empleado ya registrado' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error al crear empleado' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler, ['ADMIN', 'IT', 'RRHH']);
export const POST = withAuth(postHandler, ['ADMIN', 'IT', 'RRHH']);
