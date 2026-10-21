import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export function employeeAggregate<T extends Prisma.EmployeeAggregateArgs>(args: Prisma.Subset<T, Prisma.EmployeeAggregateArgs>) {
  return prisma.employee.aggregate<T>(args);
}

export function employeeCount<T extends Prisma.EmployeeCountArgs>(args: Prisma.Subset<T, Prisma.EmployeeCountArgs>) {
  return prisma.employee.count<T>(args);
}

export function employeeFindFirst<T extends Prisma.EmployeeFindFirstArgs>(args: Prisma.SelectSubset<T, Prisma.EmployeeFindFirstArgs>) {
  return prisma.employee.findFirst<T>(args);
}

export function employeeFindMany<T extends Prisma.EmployeeFindManyArgs>(args: Prisma.SelectSubset<T, Prisma.EmployeeFindManyArgs>) {
  return prisma.employee.findMany<T>(args);
}

export function employeeUpdate<T extends Prisma.EmployeeUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.EmployeeUpdateArgs>) {
  return prisma.employee.update<T>(args);
}

export function payslipAggregate<T extends Prisma.PayslipAggregateArgs>(args: Prisma.Subset<T, Prisma.PayslipAggregateArgs>) {
  return prisma.payslip.aggregate<T>(args);
}

export function payslipCount<T extends Prisma.PayslipCountArgs>(args: Prisma.Subset<T, Prisma.PayslipCountArgs>) {
  return prisma.payslip.count<T>(args);
}

export function payslipFindFirst<T extends Prisma.PayslipFindFirstArgs>(args: Prisma.SelectSubset<T, Prisma.PayslipFindFirstArgs>) {
  return prisma.payslip.findFirst<T>(args);
}

export function payslipFindMany<T extends Prisma.PayslipFindManyArgs>(args: Prisma.SelectSubset<T, Prisma.PayslipFindManyArgs>) {
  return prisma.payslip.findMany<T>(args);
}

export function payslipFindUnique<T extends Prisma.PayslipFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.PayslipFindUniqueArgs>) {
  return prisma.payslip.findUnique<T>(args);
}

export function payslipUpdate<T extends Prisma.PayslipUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.PayslipUpdateArgs>) {
  return prisma.payslip.update<T>(args);
}

export function payslipUpdateMany<T extends Prisma.PayslipUpdateManyArgs>(args: Prisma.SelectSubset<T, Prisma.PayslipUpdateManyArgs>) {
  return prisma.payslip.updateMany<T>(args);
}

export function payslipUpsert<T extends Prisma.PayslipUpsertArgs>(args: Prisma.SelectSubset<T, Prisma.PayslipUpsertArgs>) {
  return prisma.payslip.upsert<T>(args);
}
