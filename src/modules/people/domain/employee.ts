import type { Prisma } from '@prisma/client';

export interface EmployeeSnapshot {
  employeeId: string;
  employeeNameAtTime: string;
  employeeEmailAtTime: string;
  departmentAtTime: string;
  positionAtTime: string;
}

export function buildFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, ' ');
}

export type EmployeeCreateInput = {
  organizationId: string;
  employeeCode?: string;
  firstName: string;
  lastName: string;
  email: string;
  hireDate: string;
  phone?: string;
  dni?: string;
  departmentId?: string;
  positionId?: string;
  userId?: string;
};

export function validateHireDate(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('FECHA_INGRESO_INVALIDA');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('FECHA_INGRESO_INVALIDA');
  }
  if (date > new Date()) throw new Error('FECHA_INGRESO_FUTURA');
  return date;
}

export function toEmployeeCreateData(input: EmployeeCreateInput): Prisma.EmployeeUncheckedCreateInput {
  return {
    organizationId: input.organizationId,
    employeeCode: input.employeeCode,
    firstName: input.firstName,
    lastName: input.lastName,
    fullName: buildFullName(input.firstName, input.lastName),
    email: input.email,
    hireDate: validateHireDate(input.hireDate),
    phone: input.phone,
    dni: input.dni,
    departmentId: input.departmentId,
    positionId: input.positionId,
    userId: input.userId,
  };
}
