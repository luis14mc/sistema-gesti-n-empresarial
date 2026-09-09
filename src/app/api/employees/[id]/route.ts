import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { buildFullName, validateHireDate } from '@/lib/employees';
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
    const current = await prisma.employee.findFirst({ where: { id, organizationId } });
    if (!current) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    const fields = [
      'employeeCode', 'firstName', 'lastName', 'email', 'phone', 'dni',
      'departmentId', 'positionId', 'hireDate', 'isActive', 'userId',
    ];
    fields.forEach((field) => {
      if (data[field] !== undefined) updateData[field] = data[field];
    });

    if (data.hireDate !== undefined) updateData.hireDate = validateHireDate(data.hireDate);
    if (data.email !== undefined && !/^\S+@\S+\.\S+$/.test(String(data.email))) {
      return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
    }
    for (const field of ['employeeCode', 'departmentId', 'positionId']) {
      if (data[field] !== undefined && !String(data[field]).trim()) {
        return NextResponse.json({ error: `${field} es obligatorio` }, { status: 400 });
      }
    }

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
