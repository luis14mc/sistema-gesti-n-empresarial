import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { buildFullName } from '@/lib/employees';
import { requireOrganizationContext } from '@/modules/organizations/application/context';

async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const { organizationId } = await requireOrganizationContext(req, requestId);
    const employee = await prisma.employee.findFirst({
      where: { id, organizationId },
      include: {
        department: true,
        position: true,
        assignments: {
          include: { equipment: true },
          orderBy: { assignedDate: 'desc' },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('Error al obtener empleado:', error);
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
    const { organizationId } = await requireOrganizationContext(req, requestId);
    const data = await req.json();
    const current = await prisma.employee.findFirst({ where: { id, organizationId } });
    if (!current) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    const fields = [
      'employeeCode', 'firstName', 'lastName', 'email', 'phone', 'dni',
      'departmentId', 'positionId', 'isActive', 'userId',
    ];
    fields.forEach((field) => {
      if (data[field] !== undefined) updateData[field] = data[field];
    });

    if (data.firstName || data.lastName) {
      updateData.fullName = buildFullName(
        data.firstName ?? current.firstName,
        data.lastName ?? current.lastName
      );
    }

    const result = await prisma.employee.updateMany({
      where: { id, organizationId },
      data: updateData,
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    const employee = await prisma.employee.findFirst({
      where: { id, organizationId },
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
      },
    });

    await createAuditRecord({
      title: 'Actualización de empleado',
      description: `Se actualizó empleado: ${employee?.fullName}`,
      module: 'EQUIPOS',
      category: 'UPDATE',
      userId: req.user!.userId,
      entityId: id,
      organizationId,
    });

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('Error al actualizar empleado:', error);
    return NextResponse.json({ error: 'Error al actualizar empleado' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler, ['ADMIN', 'IT', 'RRHH']);
export const PATCH = withAuth(patchHandler, ['ADMIN', 'IT', 'RRHH']);
