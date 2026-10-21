import type { EmployeeSnapshot } from '@/modules/people/domain/employee';
import {
  createEmployee,
  findActiveMembershipWithUser,
  findEmployeeByUserOrEmail,
  findEmployeeWithPlacement,
} from '@/modules/people/infrastructure/employee-repository';

export type { EmployeeSnapshot } from '@/modules/people/domain/employee';

/**
 * Resuelve un Employee validando tenant isolation.
 * - Si viene employeeId, debe pertenecer a organizationId.
 * - Si viene userId, debe ser miembro activo de organizationId.
 * - Si no existe Employee, se crea uno nuevo en organizationId.
 *
 * @throws EMPLOYEE_NOT_FOUND si el employeeId no pertenece a la org
 * @throws EMPLOYEE_INACTIVE si el employee existe pero está inactivo
 * @throws USER_NOT_FOUND_ORG si el userId no es miembro de la org
 */
export async function resolveEmployeeSnapshot(
  organizationId: string,
  employeeId?: string,
  userId?: string
): Promise<EmployeeSnapshot> {
  if (employeeId) {
    const employee = await findEmployeeWithPlacement(organizationId, employeeId);
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
    const membership = await findActiveMembershipWithUser(organizationId, userId);
    if (!membership) throw new Error('USER_NOT_FOUND_ORG');
    const user = membership.user;
    if (!user.isActive) throw new Error('USER_INACTIVE');
    if (!user.email) throw new Error('USER_NO_EMAIL');

    let employee = await findEmployeeByUserOrEmail(organizationId, user.id, user.email);

    if (!employee) {
      employee = await createEmployee({
        organizationId,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone,
        userId: user.id,
        departmentId: user.departmentId,
        positionId: user.positionId,
        employeeCode: user.employeeNumber,
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
