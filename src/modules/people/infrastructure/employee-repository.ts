import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { findEmployeeActiveAssetsDetail } from '@/modules/people/infrastructure/employee-assets';

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

export type EmployeeListOrderBy = Prisma.EmployeeOrderByWithRelationInput;

export function listEmployees(
  where: Prisma.EmployeeWhereInput,
  skip: number,
  take: number,
  orderBy: EmployeeListOrderBy = { fullName: 'asc' },
) {
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
      orderBy,
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
      user: {
        select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
      },
      assignments: {
        include: {
          equipment: {
            select: {
              id: true,
              inventoryCode: true,
              brand: true,
              model: true,
              type: true,
            },
          },
        },
        orderBy: { assignedDate: 'desc' },
      },
    },
  });
}

export function countEmployeeHistory(organizationId: string, employeeId: string) {
  return Promise.all([
    prisma.equipmentAssignment.count({
      where: { employeeId, equipment: { organizationId } },
    }),
    prisma.licenseAssignment.count({
      where: { employeeId, seat: { subscription: { organizationId } } },
    }),
    prisma.payslip.count({ where: { employeeId, organizationId } }),
    prisma.oficio.count({ where: { responsibleEmployeeId: employeeId, organizationId } }),
    prisma.compraOrden.count({ where: { requesterEmployeeId: employeeId, organizationId } }),
    prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      select: { userId: true },
    }),
  ]).then(([assignments, licenseAssignments, payslips, oficios, purchaseOrders, employee]) => ({
    assignments,
    licenseAssignments,
    payslips,
    oficios,
    purchaseOrders,
    linkedUser: Boolean(employee?.userId),
  }));
}

export async function deleteEmployeeById(organizationId: string, id: string) {
  const existing = await findEmployee(organizationId, id);
  if (!existing) return false;
  await prisma.employee.delete({ where: { id } });
  return true;
}

export function listEmployeeAuditRecords(
  organizationId: string,
  employeeId: string,
  skip: number,
  take: number,
) {
  const where: Prisma.AuditRecordWhereInput = {
    organizationId,
    entityId: employeeId,
  };
  return Promise.all([
    prisma.auditRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        title: true,
        description: true,
        module: true,
        category: true,
        action: true,
        createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.auditRecord.count({ where }),
  ]);
}

export function findEmployee(organizationId: string, id: string) {
  return prisma.employee.findFirst({ where: { id, organizationId } });
}

export async function findEmployeeActiveAssetSummary(organizationId: string, employeeId: string) {
  const detail = await findEmployeeActiveAssetsDetail(organizationId, employeeId);
  return {
    equipos: detail.equipos.map((row) => row.codigo).filter((code): code is string => Boolean(code)),
    licencias: detail.licencias.map((row) => row.producto),
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
