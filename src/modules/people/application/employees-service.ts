import type { Prisma } from '@prisma/client';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import {
  buildFullName,
  toEmployeeCreateData,
  validateHireDate,
  type EmployeeCreateInput,
} from '@/modules/people/domain/employee';
import { parseOptionalDni } from '@/modules/people/domain/dni';
import { employeeHasHistory } from '@/modules/people/domain/employee-delete';
import {
  createEmployeeWithPlacement,
  findActiveDepartmentAndPosition,
  findEmployee,
  findEmployeeDetail,
  findEmployeeWithPlacementSummary,
  knownPrismaErrorCode,
  listActiveDepartmentsWithPositions,
  listEmployees,
  listEmployeeAuditRecords,
  updateEmployee,
  findEmployeeActiveAssetSummary,
  countEmployeeHistory,
  deleteEmployeeById,
  type EmployeeListOrderBy,
} from '@/modules/people/infrastructure/employee-repository';
import { findEmployeeActiveAssetsDetail } from '@/modules/people/infrastructure/employee-assets';
import {
  EmployeeDuplicateFieldError,
  EmployeeHasActiveAssetsError,
  EmployeeHasHistoryError,
} from '@/modules/people/domain/errors';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

/** Código de error Prisma conocido para que el controlador elija el status HTTP. */
export function persistenceErrorCode(error: unknown): string | null {
  return knownPrismaErrorCode(error);
}

export function resolveEmployeeListOrderBy(
  sortBy: string | null | undefined,
  sortDir: string | null | undefined,
): EmployeeListOrderBy {
  const direction = sortDir === 'desc' ? 'desc' : 'asc';
  switch (sortBy) {
    case 'code':
      return { employeeCode: direction };
    case 'hireDate':
      return { hireDate: direction };
    case 'name':
    default:
      return { fullName: direction };
  }
}

export function listEmployeesPage(
  where: Prisma.EmployeeWhereInput,
  skip: number,
  take: number,
  orderBy?: EmployeeListOrderBy,
) {
  return listEmployees(where, skip, take, orderBy);
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

  let normalizedDni: string | null | undefined;
  try {
    normalizedDni = parseOptionalDni(body.dni);
  } catch {
    return { kind: 'invalid', error: 'DNI inválido. Use el formato 0000-0000-00000.' };
  }

  let employee;
  try {
    employee = await createEmployeeWithPlacement(
      toEmployeeCreateData({
        ...(body as EmployeeCreateInput),
        organizationId,
        hireDate: hireDateValue.toISOString().slice(0, 10),
        dni: normalizedDni ?? undefined,
        phone: body.phone ? String(body.phone).trim() || undefined : undefined,
      }),
    );
  } catch (error) {
    const duplicateField = prismaUniqueField(error);
    if (duplicateField) throw new EmployeeDuplicateFieldError(duplicateField);
    throw error;
  }

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
  if (data.dni !== undefined) {
    try {
      updateData.dni = parseOptionalDni(data.dni);
    } catch {
      return { kind: 'invalid', error: 'DNI inválido. Use el formato 0000-0000-00000.' };
    }
  }
  if (data.phone !== undefined) {
    updateData.phone = data.phone ? String(data.phone).trim() || null : null;
  }
  for (const field of ['employeeCode', 'departmentId', 'positionId']) {
    if (data[field] !== undefined && !String(data[field]).trim()) {
      return { kind: 'invalid', error: `${field} es obligatorio` };
    }
  }

  const deactivating = data.isActive === false && current.isActive !== false;
  if (deactivating) {
    const assets = await findEmployeeActiveAssetSummary(organizationId, id);
    if (assets.equipos.length > 0 || assets.licencias.length > 0) {
      throw new EmployeeHasActiveAssetsError(assets);
    }
  }

  if (data.firstName || data.lastName) {
    updateData.fullName = buildFullName(
      data.firstName ?? current.firstName,
      data.lastName ?? current.lastName
    );
  }

  let result;
  try {
    result = await updateEmployee(organizationId, id, updateData);
  } catch (error) {
    const duplicateField = prismaUniqueField(error);
    if (duplicateField) throw new EmployeeDuplicateFieldError(duplicateField);
    throw error;
  }
  if (result.count === 0) return { kind: 'not-found' };

  const employee = await findEmployeeWithPlacementSummary(organizationId, id);

  await createAuditRecord({
    title: 'Actualización de empleado',
    description: `Se actualizó empleado: ${employee?.fullName}`,
    module: 'EQUIPOS',
    category: 'UPDATE',
    userId: actorUserId,
    entityId: id,
    entityType: 'Employee',
    organizationId,
    previousData: {
      employeeCode: current.employeeCode,
      firstName: current.firstName,
      lastName: current.lastName,
      email: current.email,
      phone: current.phone,
      dni: current.dni,
      hireDate: current.hireDate,
      departmentId: current.departmentId,
      positionId: current.positionId,
      isActive: current.isActive,
    },
    newData: updateData,
  });

  return { kind: 'ok', employee };
}

function prismaUniqueField(error: unknown): 'email' | 'employeeCode' | null {
  if (knownPrismaErrorCode(error) !== 'P2002') return null;
  const target = (error as { meta?: { target?: string[] } }).meta?.target;
  if (target?.includes('email')) return 'email';
  if (target?.includes('employeeCode')) return 'employeeCode';
  return 'email';
}

export async function deleteEmployeeRecord(
  organizationId: string,
  id: string,
  actorUserId: string,
): Promise<{ kind: 'not-found' } | { kind: 'ok' }> {
  const current = await findEmployee(organizationId, id);
  if (!current) return { kind: 'not-found' };

  const counts = await countEmployeeHistory(organizationId, id);
  if (employeeHasHistory(counts)) {
    throw new EmployeeHasHistoryError(counts);
  }

  const deleted = await deleteEmployeeById(organizationId, id);
  if (!deleted) return { kind: 'not-found' };

  await createAuditRecord({
    title: 'Eliminación de empleado',
    description: `Se eliminó empleado: ${current.fullName}`,
    module: 'EQUIPOS',
    category: 'DELETE',
    action: 'EMPLOYEE_DELETED',
    userId: actorUserId,
    entityId: id,
    entityType: 'Employee',
    organizationId,
    previousData: {
      employeeCode: current.employeeCode,
      firstName: current.firstName,
      lastName: current.lastName,
      email: current.email,
      fullName: current.fullName,
    },
  });

  return { kind: 'ok' };
}

export function getEmployeeAuditHistory(
  organizationId: string,
  employeeId: string,
  skip: number,
  take: number,
) {
  return listEmployeeAuditRecords(organizationId, employeeId, skip, take);
}

export async function getEmployeeActiveAssets(
  organizationId: string,
  employeeId: string,
  options?: { includeLicenses?: boolean },
) {
  const employee = await findEmployee(organizationId, employeeId);
  if (!employee) return null;
  const assets = await findEmployeeActiveAssetsDetail(organizationId, employeeId, options);
  return {
    employee: {
      id: employee.id,
      fullName: employee.fullName,
      employeeCode: employee.employeeCode,
      isActive: employee.isActive,
    },
    ...assets,
  };
}
