import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface EmployeeSnapshot {
  employeeId: string;
  employeeNameAtTime: string;
  employeeEmailAtTime: string;
  departmentAtTime: string;
  positionAtTime: string;
}

export async function resolveEmployeeSnapshot(
  employeeId?: string,
  userId?: string
): Promise<EmployeeSnapshot> {
  if (employeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true, position: true },
    });
    if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');
    if (!employee.isActive) throw new Error('EMPLOYEE_INACTIVE');
    if (!employee.email) throw new Error('EMPLOYEE_NO_EMAIL');

    return {
      employeeId: employee.id,
      employeeNameAtTime: employee.fullName,
      employeeEmailAtTime: employee.email,
      departmentAtTime: employee.department?.name || 'Sin departamento',
      positionAtTime: employee.position?.name || 'Sin puesto',
    };
  }

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { department: true, position: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');
    if (!user.isActive) throw new Error('USER_INACTIVE');
    if (!user.email) throw new Error('USER_NO_EMAIL');

    let employee = await prisma.employee.findFirst({
      where: { OR: [{ userId: user.id }, { email: user.email }] },
    });

    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: user.phone,
          userId: user.id,
          departmentId: user.departmentId,
          positionId: user.positionId,
          employeeCode: user.employeeNumber,
        },
      });
    }

    return {
      employeeId: employee.id,
      employeeNameAtTime: employee.fullName,
      employeeEmailAtTime: employee.email,
      departmentAtTime: user.department?.name || 'Sin departamento',
      positionAtTime: user.position?.name || 'Sin puesto',
    };
  }

  throw new Error('ASSIGNEE_REQUIRED');
}

export function buildFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, ' ');
}

export type EmployeeCreateInput = {
  employeeCode?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dni?: string;
  departmentId?: string;
  positionId?: string;
  userId?: string;
};

export function toEmployeeCreateData(input: EmployeeCreateInput): Prisma.EmployeeUncheckedCreateInput {
  return {
    employeeCode: input.employeeCode,
    firstName: input.firstName,
    lastName: input.lastName,
    fullName: buildFullName(input.firstName, input.lastName),
    email: input.email,
    phone: input.phone,
    dni: input.dni,
    departmentId: input.departmentId,
    positionId: input.positionId,
    userId: input.userId,
  };
}
