import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export function findPayrollSettings(organizationId: string) {
  return prisma.payrollSettings.findUnique({ where: { organizationId } });
}

export function findPayrollSettingsOrThrow(organizationId: string) {
  return prisma.payrollSettings.findUniqueOrThrow({ where: { organizationId } });
}

export function createPayrollSettings(data: Prisma.PayrollSettingsUncheckedCreateInput) {
  return prisma.payrollSettings.create({ data });
}

export function updatePayrollSettings(organizationId: string, data: Prisma.PayrollSettingsUncheckedUpdateInput) {
  return prisma.payrollSettings.update({ where: { organizationId }, data });
}

export function listIsrBrackets(organizationId: string, year: number) {
  return prisma.payrollIsrBracket.findMany({
    where: { organizationId, year },
    orderBy: { order: 'asc' },
  });
}

export function countIsrBrackets(organizationId: string, year: number) {
  return prisma.payrollIsrBracket.count({ where: { organizationId, year } });
}

export function createIsrBrackets(data: Prisma.PayrollIsrBracketCreateManyInput[]) {
  return prisma.payrollIsrBracket.createMany({ data });
}

export async function replaceIsrBrackets(
  organizationId: string,
  year: number,
  data: Prisma.PayrollIsrBracketCreateManyInput[],
) {
  await prisma.$transaction([
    prisma.payrollIsrBracket.deleteMany({ where: { organizationId, year } }),
    prisma.payrollIsrBracket.createMany({ data }),
  ]);
}

export function findPayrollSmtpSettings(organizationId: string) {
  return prisma.payrollSmtpSettings.findUnique({ where: { organizationId } });
}

export function updatePayrollSmtpSettings(organizationId: string, data: Prisma.PayrollSmtpSettingsUncheckedUpdateInput) {
  return prisma.payrollSmtpSettings.update({ where: { organizationId }, data });
}

export function createPayrollSmtpSettings(data: Prisma.PayrollSmtpSettingsUncheckedCreateInput) {
  return prisma.payrollSmtpSettings.create({ data });
}
