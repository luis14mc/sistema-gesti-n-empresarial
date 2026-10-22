import type { Prisma } from '@prisma/client';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { buildFullName, toEmployeeCreateData, validateHireDate } from '@/modules/people/domain/employee';
import {
  createEmployeeWithPlacement,
  findActiveDepartmentAndPosition,
  findEmployee,
  findEmployeeDetail,
  findEmployeeWithPlacementSummary,
  knownPrismaErrorCode,
  listActiveDepartmentsWithPositions,
  listEmployees,
  updateEmployee,
} from '@/modules/people/infrastructure/employee-repository';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

/** Código de error Prisma conocido para que el controlador elija el status HTTP. */
export function persistenceErrorCode(error: unknown): string | null {
  return knownPrismaErrorCode(error);
}

export function listEmployeesPage(where: Prisma.EmployeeWhereInput, skip: number, take: number) {
  return listEmployees(where, skip, take);
}

export function getEmployeeDetail(scope: { where: { id: string; organizationId: string } }) {
  return findEmployeeDetail(scope);
}

export function listDepartments(organizationId: string) {
  return listActiveDepartmentsWithPositions(organizationId);
}

type EmployeeCommandResult<T> = { kind: 'invalid'; error: string } | { kind: 'not-found' } | { kind: 'ok'; employee: T };

export async function createEmployee(
  organizationId: string,
  body: Record<string, any>,
  actorUserId: string,
): Promise<EmployeeCommandResult<Awaited<ReturnType<typeof createEmployeeWithPlacement>>>> {
  const { firstName, lastName, email, employeeCode, hireDate, departmentId, positionId } = body;

  if (!firstName || !lastName || !email || !employeeCode || !hireDate || !departmentId || !positionId) {
    return { kind: 'invalid', error: 'Nombre, apellido y correo son requeridos' };
  }
  if (!EMAIL_PATTERN.test(String(email))) {
    return { kind: 'invalid', error: 'Correo inválido' };
  }

  let hireDateValue: Date;
  try {
    hireDateValue = validateHireDate(hireDate);
  } catch (error) {
    return {
      kind: 'invalid',
      error: error instanceof Error && error.message === 'FECHA_INGRESO_FUTURA'
        ? 'La fecha de ingreso no puede ser futura'
        : 'Fecha de ingreso inválida',
    };
  }
  const [department, position] = await findActiveDepartmentAndPosition(organizationId, departmentId, positionId);
  if (!department || !position || position.departmentId !== department.id) {
    return { kind: 'invalid', error: 'Departamento o puesto inválido' };
  }

  const employee = await createEmployeeWithPlacement(
    toEmployeeCreateData({ ...(body as any), organizationId, hireDate: hireDateValue.toISOString().slice(0, 10) }),
  );

  await createAuditRecord({
    title: 'Creación de empleado',
    description: `Se registró empleado: ${employee.fullName}`,
    module: 'EQUIPOS',
    category: 'CREATE',
    userId: actorUserId,
    entityId: employee.id,
    organizationId,
    newData: { email: employee.email, fullName: employee.fullName },
  });

  return { kind: 'ok', employee };
}

const UPDATABLE_FIELDS = [
  'employeeCode', 'firstName', 'lastName', 'email', 'phone', 'dni',
  'departmentId', 'positionId', 'hireDate', 'isActive', 'userId',
];

export async function updateEmployeeFields(
  organizationId: string,
  id: string,
  data: Record<string, any>,
  actorUserId: string,
): Promise<EmployeeCommandResult<Awaited<ReturnType<typeof findEmployeeWithPlacementSummary>>>> {
  const current = await findEmployee(organizationId, id);
  if (!current) return { kind: 'not-found' };

  const updateData: Record<string, unknown> = {};
  UPDATABLE_FIELDS.forEach((field) => {
    if (data[field] !== undefined) updateData[field] = data[field];
  });

  if (data.hireDate !== undefined) updateData.hireDate = validateHireDate(data.hireDate);
  if (data.email !== undefined && !EMAIL_PATTERN.test(String(data.email))) {
    return { kind: 'invalid', error: 'Correo inválido' };
  }
  for (const field of ['employeeCode', 'departmentId', 'positionId']) {
    if (data[field] !== undefined && !String(data[field]).trim()) {
      return { kind: 'invalid', error: `${field} es obligatorio` };
    }
  }

  if (data.firstName || data.lastName) {
    updateData.fullName = buildFullName(
      data.firstName ?? current.firstName,
      data.lastName ?? current.lastName
    );
  }

  const result = await updateEmployee(organizationId, id, updateData);
  if (result.count === 0) return { kind: 'not-found' };

  const employee = await findEmployeeWithPlacementSummary(organizationId, id);

  await createAuditRecord({
    title: 'Actualización de empleado',
    description: `Se actualizó empleado: ${employee?.fullName}`,
    module: 'EQUIPOS',
    category: 'UPDATE',
    userId: actorUserId,
    entityId: id,
    organizationId,
  });

  return { kind: 'ok', employee };
}
