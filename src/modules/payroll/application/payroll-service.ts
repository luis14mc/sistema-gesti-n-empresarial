import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculatePayslip, periodFromPayMonth } from '@/modules/payroll/domain';
import { loadPayrollSettings } from '@/modules/payroll/application/settings-loader';
import { mapPayslipAmounts } from '@/modules/payroll/application/mappers';
import { renderAndStorePayslipPdf } from '@/modules/payroll/infrastructure/payslip-pdf';

const PAY_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parsePayMonth(payMonth: string): { year: number; month: number } {
  if (!PAY_MONTH_RE.test(payMonth)) {
    throw new Error('INVALID_PAY_MONTH');
  }
  const [yearStr, monthStr] = payMonth.split('-');
  return { year: Number(yearStr), month: Number(monthStr) };
}

type PayrollEmployeeRow = {
  id: string;
  fullName: string;
  employeeCode: string | null;
  email: string;
  hireDate: Date | null;
  monthlySalary: Prisma.Decimal | null;
  otherDeduction: Prisma.Decimal;
  otherDeductionNote: string | null;
  payrollEnabled: boolean;
  isActive: boolean;
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
};

function employeeToInput(employee: PayrollEmployeeRow, payMonth: string) {
  if (!employee.payrollEnabled) throw new Error('EMPLOYEE_NOT_PAYROLL_ENABLED');
  if (!employee.hireDate) throw new Error('EMPLOYEE_MISSING_HIRE_DATE');
  if (employee.monthlySalary === null) throw new Error('EMPLOYEE_MISSING_SALARY');
  return {
    monthlySalary: Number(employee.monthlySalary.toString()),
    hireDate: employee.hireDate,
    payMonth,
    otherDeductions: Number(employee.otherDeduction.toString()),
  };
}

async function getPayrollEmployee(organizationId: string, employeeId: string): Promise<PayrollEmployeeRow> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      email: true,
      hireDate: true,
      monthlySalary: true,
      otherDeduction: true,
      otherDeductionNote: true,
      payrollEnabled: true,
      isActive: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
    },
  });
  if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');
  return employee;
}

export async function listPayrollEmployees(
  organizationId: string,
  filters: { search?: string; payrollEnabled?: boolean; page?: number; pageSize?: number },
) {
  const page = filters.page ?? 1;
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
  const skip = (page - 1) * pageSize;
  const where: Prisma.EmployeeWhereInput = { organizationId, isActive: true };
  if (filters.payrollEnabled !== undefined) where.payrollEnabled = filters.payrollEnabled;
  if (filters.search) {
    where.OR = [
      { fullName: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { employeeCode: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        email: true,
        hireDate: true,
        monthlySalary: true,
        otherDeduction: true,
        otherDeductionNote: true,
        payrollEnabled: true,
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
      },
    }),
    prisma.employee.count({ where }),
  ]);

  return {
    employees: employees.map((e) => ({
      ...e,
      monthlySalary: e.monthlySalary ? Number(e.monthlySalary.toString()) : null,
      otherDeduction: Number(e.otherDeduction.toString()),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getPayrollEmployeeDetail(organizationId: string, employeeId: string) {
  const employee = await getPayrollEmployee(organizationId, employeeId);
  return {
    ...employee,
    monthlySalary: employee.monthlySalary ? Number(employee.monthlySalary.toString()) : null,
    otherDeduction: Number(employee.otherDeduction.toString()),
  };
}

export async function patchPayrollEmployee(
  organizationId: string,
  employeeId: string,
  data: {
    monthlySalary?: number | null;
    otherDeduction?: number;
    otherDeductionNote?: string | null;
    payrollEnabled?: boolean;
  },
) {
  await getPayrollEmployee(organizationId, employeeId);
  const updated = await prisma.employee.update({
    where: { id: employeeId },
    data: {
      ...(data.monthlySalary !== undefined
        ? { monthlySalary: data.monthlySalary === null ? null : data.monthlySalary }
        : {}),
      ...(data.otherDeduction !== undefined ? { otherDeduction: data.otherDeduction } : {}),
      ...(data.otherDeductionNote !== undefined ? { otherDeductionNote: data.otherDeductionNote } : {}),
      ...(data.payrollEnabled !== undefined ? { payrollEnabled: data.payrollEnabled } : {}),
    },
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      email: true,
      hireDate: true,
      monthlySalary: true,
      otherDeduction: true,
      otherDeductionNote: true,
      payrollEnabled: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
    },
  });
  return {
    ...updated,
    monthlySalary: updated.monthlySalary ? Number(updated.monthlySalary.toString()) : null,
    otherDeduction: Number(updated.otherDeduction.toString()),
  };
}

export async function previewPayslip(organizationId: string, employeeId: string, payMonth: string) {
  const { year } = parsePayMonth(payMonth);
  const employee = await getPayrollEmployee(organizationId, employeeId);
  const settings = await loadPayrollSettings(organizationId, year);
  const result = calculatePayslip({ ...employeeToInput(employee, payMonth), settings });
  return {
    employeeId,
    payMonth,
    ...mapPayslipAmounts(result),
    payPeriod: {
      start: result.payPeriod.start.toISOString().slice(0, 10),
      end: result.payPeriod.end.toISOString().slice(0, 10),
      year: result.payPeriod.year,
      month: result.payPeriod.month,
    },
    monthsWorkedInYear: result.monthsWorkedInYear,
    isPrimerMes: result.isPrimerMes,
  };
}

export async function generatePayslip(
  organizationId: string,
  employeeId: string,
  payMonth: string,
  generatedById: string,
  options?: { skipPdf?: boolean },
) {
  const { year, month } = parsePayMonth(payMonth);
  const employee = await getPayrollEmployee(organizationId, employeeId);
  const settings = await loadPayrollSettings(organizationId, year);
  const result = calculatePayslip({ ...employeeToInput(employee, payMonth), settings });
  const amounts = mapPayslipAmounts(result);

  let pdfStorageKey: string | null = null;
  if (!options?.skipPdf) {
    pdfStorageKey = await renderAndStorePayslipPdf({
      organizationId,
      employeeId,
      employeeName: employee.fullName,
      employeeCode: employee.employeeCode,
      year,
      month,
      periodStart: result.payPeriod.start,
      periodEnd: result.payPeriod.end,
      ...amounts,
    });
  }

  const payslip = await prisma.payslip.upsert({
    where: {
      organizationId_employeeId_year_month: { organizationId, employeeId, year, month },
    },
    create: {
      organizationId,
      employeeId,
      year,
      month,
      periodStart: result.payPeriod.start,
      periodEnd: result.payPeriod.end,
      salarioPeriodo: amounts.salarioPeriodo,
      ihss: amounts.ihss,
      isr: amounts.isr,
      otro: amounts.otro,
      totalDeducciones: amounts.totalDeducciones,
      neto: amounts.neto,
      parametersSnapshot: settings as unknown as Prisma.InputJsonValue,
      pdfStorageKey,
      generatedById,
    },
    update: {
      periodStart: result.payPeriod.start,
      periodEnd: result.payPeriod.end,
      salarioPeriodo: amounts.salarioPeriodo,
      ihss: amounts.ihss,
      isr: amounts.isr,
      otro: amounts.otro,
      totalDeducciones: amounts.totalDeducciones,
      neto: amounts.neto,
      parametersSnapshot: settings as unknown as Prisma.InputJsonValue,
      pdfStorageKey: pdfStorageKey ?? undefined,
      generatedById,
      generatedAt: new Date(),
    },
    include: {
      employee: { select: { id: true, fullName: true, employeeCode: true } },
    },
  });

  return serializePayslip(payslip);
}

export async function resolveBatchEmployeeIds(
  organizationId: string,
  employeeIds?: string[],
): Promise<string[]> {
  if (employeeIds?.length) return employeeIds;
  const rows = await prisma.employee.findMany({
    where: { organizationId, isActive: true, payrollEnabled: true },
    select: { id: true },
    orderBy: { fullName: 'asc' },
  });
  return rows.map((r) => r.id);
}

export async function batchGeneratePayslips(
  organizationId: string,
  payMonth: string,
  employeeIds: string[] | undefined,
  generatedById: string,
) {
  const ids = await resolveBatchEmployeeIds(organizationId, employeeIds);
  const results: Array<{ employeeId: string; ok: boolean; payslipId?: string; error?: string }> = [];
  for (const employeeId of ids) {
    try {
      const payslip = await generatePayslip(organizationId, employeeId, payMonth, generatedById);
      results.push({ employeeId, ok: true, payslipId: payslip.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PAYROLL_ERROR';
      results.push({ employeeId, ok: false, error: message });
    }
  }
  return { payMonth, results, succeeded: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
}

export async function listPayslips(
  organizationId: string,
  filters: { year?: number; month?: number; employeeId?: string; page?: number; pageSize?: number },
) {
  const page = filters.page ?? 1;
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
  const skip = (page - 1) * pageSize;
  const where: Prisma.PayslipWhereInput = { organizationId };
  if (filters.year !== undefined) where.year = filters.year;
  if (filters.month !== undefined) where.month = filters.month;
  if (filters.employeeId) where.employeeId = filters.employeeId;

  const [items, total] = await Promise.all([
    prisma.payslip.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { employee: { fullName: 'asc' } }],
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true } },
      },
    }),
    prisma.payslip.count({ where }),
  ]);

  return {
    payslips: items.map(serializePayslip),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getPayslipPdfBuffer(organizationId: string, payslipId: string) {
  const payslip = await prisma.payslip.findFirst({
    where: { id: payslipId, organizationId },
    include: { employee: { select: { fullName: true, employeeCode: true } } },
  });
  if (!payslip) throw new Error('PAYSLIP_NOT_FOUND');

  const amounts = {
    salarioPeriodo: Number(payslip.salarioPeriodo.toString()),
    ihss: Number(payslip.ihss.toString()),
    isr: Number(payslip.isr.toString()),
    otro: Number(payslip.otro.toString()),
    totalDeducciones: Number(payslip.totalDeducciones.toString()),
    neto: Number(payslip.neto.toString()),
  };

  const { getStorage } = await import('@/lib/storage');
  if (payslip.pdfStorageKey) {
    const object = await getStorage().get(payslip.pdfStorageKey);
    if (object) return { buffer: object.buffer, filename: `${payslip.employee.fullName}-planilla.pdf` };
  }

  const key = await renderAndStorePayslipPdf({
    organizationId,
    employeeId: payslip.employeeId,
    employeeName: payslip.employee.fullName,
    employeeCode: payslip.employee.employeeCode,
    year: payslip.year,
    month: payslip.month,
    periodStart: payslip.periodStart,
    periodEnd: payslip.periodEnd,
    ...amounts,
  });
  await prisma.payslip.update({ where: { id: payslip.id }, data: { pdfStorageKey: key } });
  const object = await getStorage().get(key);
  if (!object) throw new Error('PAYSLIP_NOT_FOUND');
  return { buffer: object.buffer, filename: `${payslip.employee.fullName}-planilla.pdf` };
}

function serializePayslip(
  row: {
    id: string;
    organizationId: string;
    employeeId: string;
    year: number;
    month: number;
    periodStart: Date;
    periodEnd: Date;
    salarioPeriodo: Prisma.Decimal;
    ihss: Prisma.Decimal;
    isr: Prisma.Decimal;
    otro: Prisma.Decimal;
    totalDeducciones: Prisma.Decimal;
    neto: Prisma.Decimal;
    pdfStorageKey: string | null;
    emailStatus: string;
    generatedAt: Date;
    employee?: { id: string; fullName: string; employeeCode: string | null };
  },
) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    year: row.year,
    month: row.month,
    periodStart: row.periodStart.toISOString().slice(0, 10),
    periodEnd: row.periodEnd.toISOString().slice(0, 10),
    salarioPeriodo: Number(row.salarioPeriodo.toString()),
    ihss: Number(row.ihss.toString()),
    isr: Number(row.isr.toString()),
    otro: Number(row.otro.toString()),
    totalDeducciones: Number(row.totalDeducciones.toString()),
    neto: Number(row.neto.toString()),
    pdfStorageKey: row.pdfStorageKey,
    emailStatus: row.emailStatus,
    generatedAt: row.generatedAt.toISOString(),
    employee: row.employee,
  };
}

export { periodFromPayMonth };
