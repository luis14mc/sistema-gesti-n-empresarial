import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

const CUID_LIKE = /^c[a-z0-9]{20,}$/i;

export function isLikelyRecordId(ref: string): boolean {
  return CUID_LIKE.test(ref.trim());
}

export async function employeeBelongsToOrganization(
  db: Db,
  employeeId: string,
  organizationId: string,
): Promise<boolean> {
  const row = await db.employee.findFirst({
    where: { id: employeeId, organizationId },
    select: { id: true },
  });
  return Boolean(row);
}

export async function assertEmployeeBelongsToOrganization(
  db: Db,
  employeeId: string,
  organizationId: string,
): Promise<void> {
  const ok = await employeeBelongsToOrganization(db, employeeId, organizationId);
  if (!ok) {
    throw new Error('EMPLOYEE_OUT_OF_ORGANIZATION');
  }
}
