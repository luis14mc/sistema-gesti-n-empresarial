import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const placementSelect = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
} as const;

export function findEmployeeWithPlacement(organizationId: string, employeeId: string) {
  return prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
    include: { department: true, position: true },
  });
}

export function findActiveMembershipWithUser(organizationId: string, userId: string) {
  return prisma.organizationMembership.findFirst({
    where: { userId, organizationId, status: 'ACTIVE' },
    include: {
      user: {
        include: { department: true, position: true },
      },
    },
  });
}

export function findEmployeeByUserOrEmail(organizationId: string, userId: string, email: string) {
  return prisma.employee.findFirst({
    where: { organizationId, OR: [{ userId }, { email }] },
  });
}

export function createEmployee(data: Prisma.EmployeeUncheckedCreateInput) {
  return prisma.employee.create({ data });
}

export function createEmployeeWithPlacement(data: Prisma.EmployeeUncheckedCreateInput) {
  return prisma.employee.create({
    data,
    include: placementSelect,
  });
}

export function listEmployees(where: Prisma.EmployeeWhereInput, skip: number, take: number) {
  return Promise.all([
    prisma.employee.findMany({
      where,
      skip,
      take,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        email: true,
        employeeCode: true,
        hireDate: true,
        isActive: true,
        ...placementSelect,
      },
      orderBy: { fullName: 'asc' },
    }),
    prisma.employee.count({ where }),
  ]);
}

export function findEmployeeDetail(scope: { where: { id: string; organizationId: string } }) {
  return prisma.employee.findFirst({
    where: scope.where,
    include: {
      department: true,
      position: true,
      assignments: {
        include: { equipment: true },
        orderBy: { assignedDate: 'desc' },
      },
    },
  });
}

export function findEmployee(organizationId: string, id: string) {
  return prisma.employee.findFirst({ where: { id, organizationId } });
}

export async function findEmployeeActiveAssetSummary(organizationId: string, employeeId: string) {
  const [equipmentAssignments, licenseAssignments] = await Promise.all([
    prisma.equipmentAssignment.findMany({
      where: {
        employeeId,
        status: 'ACTIVE',
        equipment: { organizationId },
      },
      select: { equipment: { select: { inventoryCode: true } } },
    }),
    prisma.licenseAssignment.findMany({
      where: {
        employeeId,
        unassignedAt: null,
        seat: { subscription: { organizationId } },
      },
      select: {
        seat: { select: { subscription: { select: { product: { select: { name: true } } } } } },
      },
    }),
  ]);

  return {
    equipos: equipmentAssignments
      .map((row) => row.equipment.inventoryCode)
      .filter((code): code is string => Boolean(code)),
    licencias: licenseAssignments.map((row) => row.seat.subscription.product.name),
  };
}

export function findEmployeeWithPlacementSummary(organizationId: string, id: string) {
  return prisma.employee.findFirst({
    where: { id, organizationId },
    include: placementSelect,
  });
}

export function updateEmployee(organizationId: string, id: string, data: Record<string, unknown>) {
  return prisma.employee.updateMany({
    where: { id, organizationId },
    data,
  });
}

export function findActiveDepartmentAndPosition(organizationId: string, departmentId: string, positionId: string) {
  return Promise.all([
    prisma.department.findFirst({ where: { id: departmentId, organizationId, isActive: true } }),
    prisma.jobPosition.findFirst({ where: { id: positionId, department: { organizationId }, isActive: true } }),
  ]);
}

export function listActiveDepartmentsWithPositions(organizationId: string) {
  return prisma.department.findMany({
    where: { organizationId, isActive: true },
    include: {
      positions: {
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });
}

/** Código Prisma conocido (P2002, P1001…) o `null` si el error no viene de Prisma. */
export function knownPrismaErrorCode(error: unknown): string | null {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
}
