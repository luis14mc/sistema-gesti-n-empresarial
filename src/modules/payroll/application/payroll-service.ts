import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculatePayslip, periodFromPayMonth } from '@/modules/payroll/domain';
import { PayrollDomainError } from '@/modules/payroll/domain/errors';
import { loadPayrollSettings } from '@/modules/payroll/application/settings-loader';
import { mapPayslipAmounts } from '@/modules/payroll/application/mappers';
import { buildPayslipHtml, renderAndStorePayslipPdf } from '@/modules/payroll/infrastructure/payslip-pdf';
import { renderPayslipAuditPdf, type PayslipAuditRow } from '@/modules/payroll/infrastructure/payslip-audit-pdf';

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

export type PayslipOtroOverride = {
  otro?: number;
  otroConcepto?: string | null;
};

type ExistingPayslipOtro = { otro: number; otroConcepto: string | null };

function resolveOtroForGeneration(
  employee: PayrollEmployeeRow,
  override: PayslipOtroOverride | undefined,
  existing?: ExistingPayslipOtro | null,
): { amount: number; concepto: string | null } {
  const amount = override?.otro !== undefined
    ? override.otro
    : existing
      ? existing.otro
      : Number(employee.otherDeduction.toString());

  let concepto: string | null;
  if (override !== undefined && Object.prototype.hasOwnProperty.call(override, 'otroConcepto')) {
    const rawConcept = override.otroConcepto;
    concepto = rawConcept === undefined || rawConcept === null || rawConcept.trim() === ''
      ? null
      : rawConcept.trim();
  } else if (existing) {
    concepto = existing.otroConcepto;
  } else {
    concepto = null;
  }
  return { amount, concepto };
}

function assertOtroWithinSalario(otro: number, salarioPeriodo: number) {
  if (otro > salarioPeriodo) {
    throw new PayrollDomainError(
      'La deducción "Otro" no puede superar el salario del periodo.',
      'PAYROLL_OTRO_EXCEEDS_SALARY',
    );
  }
}

async function loadExistingPayslipOtro(
  organizationId: string,
  employeeId: string,
  year: number,
  month: number,
): Promise<ExistingPayslipOtro | null> {
  const row = await prisma.payslip.findUnique({
    where: { organizationId_employeeId_year_month: { organizationId, employeeId, year, month } },
    select: { otro: true, otroConcepto: true },
  });
  if (!row) return null;
  return {
    otro: Number(row.otro.toString()),
    otroConcepto: row.otroConcepto ?? null,
  };
}

function employeeToInput(
  employee: PayrollEmployeeRow,
  payMonth: string,
  otroOverride?: PayslipOtroOverride,
  existingOtro?: ExistingPayslipOtro | null,
) {
  if (!employee.payrollEnabled) throw new Error('EMPLOYEE_NOT_PAYROLL_ENABLED');
  if (!employee.hireDate) throw new Error('EMPLOYEE_MISSING_HIRE_DATE');
  if (employee.monthlySalary === null) throw new Error('EMPLOYEE_MISSING_SALARY');
  const otro = resolveOtroForGeneration(employee, otroOverride, existingOtro);
  return {
    monthlySalary: Number(employee.monthlySalary.toString()),
    hireDate: employee.hireDate,
    payMonth,
    otherDeductions: otro.amount,
    otroConcepto: otro.concepto,
  };
}

function toPayslipCalcInput(input: ReturnType<typeof employeeToInput>) {
  const { otroConcepto: _ignored, ...calcInput } = input;
  return calcInput;
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

function employeePreviewAmounts(
  employee: PayrollEmployeeRow,
  payMonth: string,
  settings: Awaited<ReturnType<typeof loadPayrollSettings>>,
): { previewIhss: number | null; previewIsr: number | null } {
  if (!employee.payrollEnabled || !employee.hireDate || employee.monthlySalary === null) {
    return { previewIhss: null, previewIsr: null };
  }
  try {
    const result = calculatePayslip({
      ...toPayslipCalcInput(employeeToInput(employee, payMonth)),
      settings,
    });
    return { previewIhss: result.ihss, previewIsr: result.isr };
  } catch {
    return { previewIhss: null, previewIsr: null };
  }
}

export async function listPayrollEmployees(
  organizationId: string,
  filters: {
    search?: string;
    payrollEnabled?: boolean;
    page?: number;
    pageSize?: number;
    previewPayMonth?: string;
  },
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
      { position: { name: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  const statsWhere: Prisma.EmployeeWhereInput = {
    organizationId,
    isActive: true,
    payrollEnabled: true,
    monthlySalary: { not: null },
  };

  const previewPayMonth = filters.previewPayMonth;
  let previewSettings: Awaited<ReturnType<typeof loadPayrollSettings>> | null = null;
  if (previewPayMonth && PAY_MONTH_RE.test(previewPayMonth)) {
    const { year } = parsePayMonth(previewPayMonth);
    previewSettings = await loadPayrollSettings(organizationId, year);
  }

  const [employees, total, statsAgg] = await Promise.all([
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
        isActive: true,
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
      },
    }),
    prisma.employee.count({ where }),
    prisma.employee.aggregate({
      where: statsWhere,
      _count: { _all: true },
      _sum: { monthlySalary: true },
      _avg: { monthlySalary: true },
    }),
  ]);

  const stats = {
    totalPayrollEmployees: statsAgg._count._all,
    totalMonthlyPayroll: statsAgg._sum.monthlySalary
      ? Number(statsAgg._sum.monthlySalary.toString())
      : 0,
    averageMonthlySalary: statsAgg._avg.monthlySalary
      ? Number(statsAgg._avg.monthlySalary.toString())
      : 0,
  };

  return {
    employees: employees.map((e) => {
      const base = {
        ...e,
        hireDate: e.hireDate ? e.hireDate.toISOString().slice(0, 10) : null,
        monthlySalary: e.monthlySalary ? Number(e.monthlySalary.toString()) : null,
        otherDeduction: Number(e.otherDeduction.toString()),
      };
      if (!previewSettings || !previewPayMonth) return base;
      const preview = employeePreviewAmounts(e, previewPayMonth, previewSettings);
      return { ...base, ...preview };
    }),
    stats,
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
    hireDate: employee.hireDate ? employee.hireDate.toISOString().slice(0, 10) : null,
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

export async function previewPayslip(
  organizationId: string,
  employeeId: string,
  payMonth: string,
  otroOverride?: PayslipOtroOverride,
) {
  const { year, month } = parsePayMonth(payMonth);
  const employee = await getPayrollEmployee(organizationId, employeeId);
  const settings = await loadPayrollSettings(organizationId, year);
  const existingOtro = await loadExistingPayslipOtro(organizationId, employeeId, year, month);
  const input = employeeToInput(employee, payMonth, otroOverride, existingOtro);
  const result = calculatePayslip({ ...toPayslipCalcInput(input), settings });
  const amounts = mapPayslipAmounts(result);
  assertOtroWithinSalario(amounts.otro, amounts.salarioPeriodo);
  const previewHtml = await buildPayslipHtml({
    organizationId,
    employeeId,
    employeeName: employee.fullName,
    employeeCode: employee.employeeCode,
    employeeEmail: employee.email,
    positionName: employee.position?.name ?? null,
    year,
    month,
    periodStart: result.payPeriod.start,
    periodEnd: result.payPeriod.end,
    otroConcepto: input.otroConcepto,
    ...amounts,
  });
  return {
    employeeId,
    payMonth,
    ...amounts,
    previewHtml,
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
  options?: { skipPdf?: boolean; otroOverride?: PayslipOtroOverride },
) {
  const { year, month } = parsePayMonth(payMonth);
  const employee = await getPayrollEmployee(organizationId, employeeId);
  const settings = await loadPayrollSettings(organizationId, year);
  const existingOtro = await loadExistingPayslipOtro(organizationId, employeeId, year, month);
  const input = employeeToInput(employee, payMonth, options?.otroOverride, existingOtro);
  const result = calculatePayslip({ ...toPayslipCalcInput(input), settings });
  const amounts = mapPayslipAmounts(result);
  assertOtroWithinSalario(amounts.otro, amounts.salarioPeriodo);

  let pdfStorageKey: string | null = null;
  if (!options?.skipPdf) {
    pdfStorageKey = await renderAndStorePayslipPdf({
      organizationId,
      employeeId,
      employeeName: employee.fullName,
      employeeCode: employee.employeeCode,
      employeeEmail: employee.email,
      positionName: employee.position?.name ?? null,
      year,
      month,
      periodStart: result.payPeriod.start,
      periodEnd: result.payPeriod.end,
      otroConcepto: input.otroConcepto,
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
      otroConcepto: input.otroConcepto,
      totalDeducciones: amounts.totalDeducciones,
      neto: amounts.neto,
      parametersSnapshot: settings as unknown as Prisma.InputJsonValue,
      pdfStorageKey,
      deliveryType: 'PDF',
      generatedById,
    },
    update: {
      periodStart: result.payPeriod.start,
      periodEnd: result.payPeriod.end,
      salarioPeriodo: amounts.salarioPeriodo,
      ihss: amounts.ihss,
      isr: amounts.isr,
      otro: amounts.otro,
      otroConcepto: input.otroConcepto,
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
  employeeAdjustments?: Array<PayslipOtroOverride & { employeeId: string }>,
) {
  const ids = await resolveBatchEmployeeIds(organizationId, employeeIds);
  const adjustmentByEmployee = new Map(
    (employeeAdjustments ?? []).map((row) => [row.employeeId, row]),
  );
  const results: Array<{ employeeId: string; ok: boolean; payslipId?: string; error?: string }> = [];
  for (const employeeId of ids) {
    try {
      const adjustment = adjustmentByEmployee.get(employeeId);
      let otroOverride: PayslipOtroOverride | undefined;
      if (adjustment) {
        otroOverride = {};
        if (adjustment.otro !== undefined) otroOverride.otro = adjustment.otro;
        if (Object.prototype.hasOwnProperty.call(adjustment, 'otroConcepto')) {
          otroOverride.otroConcepto = adjustment.otroConcepto;
        }
      }
      const payslip = await generatePayslip(organizationId, employeeId, payMonth, generatedById, {
        otroOverride,
      });
      results.push({ employeeId, ok: true, payslipId: payslip.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PAYROLL_ERROR';
      results.push({ employeeId, ok: false, error: message });
    }
  }
  return { payMonth, results, succeeded: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
}

function buildPayslipListWhere(
  organizationId: string,
  filters: {
    year?: number;
    month?: number;
    employeeId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): Prisma.PayslipWhereInput {
  const where: Prisma.PayslipWhereInput = { organizationId };
  if (filters.year !== undefined) where.year = filters.year;
  if (filters.month !== undefined) where.month = filters.month;
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.search) {
    where.employee = {
      OR: [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { employeeCode: { contains: filters.search, mode: 'insensitive' } },
      ],
    };
  }
  if (filters.dateFrom || filters.dateTo) {
    where.generatedAt = {};
    if (filters.dateFrom) {
      where.generatedAt.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
    }
    if (filters.dateTo) {
      where.generatedAt.lte = new Date(`${filters.dateTo}T23:59:59.999Z`);
    }
  }
  return where;
}

export async function listPayslips(
  organizationId: string,
  filters: {
    year?: number;
    month?: number;
    employeeId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const page = filters.page ?? 1;
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 500);
  const skip = (page - 1) * pageSize;
  const where = buildPayslipListWhere(organizationId, filters);

  const [items, total, aggregate] = await Promise.all([
    prisma.payslip.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ generatedAt: 'desc' }, { year: 'desc' }, { month: 'desc' }],
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            position: { select: { name: true } },
          },
        },
      },
    }),
    prisma.payslip.count({ where }),
    prisma.payslip.aggregate({
      where,
      _sum: { neto: true, totalDeducciones: true },
    }),
  ]);

  return {
    payslips: items.map(serializePayslip),
    summary: {
      recordCount: total,
      netPayTotal: aggregate._sum.neto ? Number(aggregate._sum.neto.toString()) : 0,
      deductionsTotal: aggregate._sum.totalDeducciones
        ? Number(aggregate._sum.totalDeducciones.toString())
        : 0,
    },
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function exportPayslipsAuditPdf(
  organizationId: string,
  filters: { search?: string; dateFrom?: string; dateTo?: string },
) {
  const where = buildPayslipListWhere(organizationId, filters);
  const items = await prisma.payslip.findMany({
    where,
    orderBy: [{ generatedAt: 'desc' }],
    take: 5000,
    include: {
      employee: {
        select: {
          fullName: true,
          employeeCode: true,
          position: { select: { name: true } },
        },
      },
    },
  });

  const rows: PayslipAuditRow[] = items.map((p) => ({
    generatedAt: p.generatedAt,
    employeeCode: p.employee.employeeCode,
    employeeName: p.employee.fullName,
    positionName: p.employee.position?.name ?? null,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    salarioPeriodo: Number(p.salarioPeriodo.toString()),
    ihss: Number(p.ihss.toString()),
    isr: Number(p.isr.toString()),
    otro: Number(p.otro.toString()),
    totalDeducciones: Number(p.totalDeducciones.toString()),
    neto: Number(p.neto.toString()),
    deliveryType: p.deliveryType,
  }));

  const filterParts: string[] = [];
  if (filters.search) filterParts.push(`búsqueda "${filters.search}"`);
  if (filters.dateFrom) filterParts.push(`desde ${filters.dateFrom}`);
  if (filters.dateTo) filterParts.push(`hasta ${filters.dateTo}`);
  const filterLabel = filterParts.join(', ');

  const buffer = await renderPayslipAuditPdf(rows, filterLabel);
  const { getStorage } = await import('@/lib/storage');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const stored = await getStorage().put({
    prefix: `organizations/${organizationId}/payroll/audits`,
    originalName: `auditoria-${stamp}.pdf`,
    mimeType: 'application/pdf',
    size: buffer.length,
    buffer,
    desiredName: `auditoria-${stamp}.pdf`,
  });

  return { buffer, storageKey: stored.key, recordCount: rows.length };
}

export async function getPayslipPdfBuffer(organizationId: string, payslipId: string) {
  const payslip = await prisma.payslip.findFirst({
    where: { id: payslipId, organizationId },
    include: {
      employee: {
        select: {
          fullName: true,
          employeeCode: true,
          email: true,
          position: { select: { name: true } },
        },
      },
    },
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
    employeeEmail: payslip.employee.email ?? '',
    positionName: payslip.employee.position?.name ?? null,
    year: payslip.year,
    month: payslip.month,
    periodStart: payslip.periodStart,
    periodEnd: payslip.periodEnd,
    otroConcepto: payslip.otroConcepto,
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
    otroConcepto?: string | null;
    totalDeducciones: Prisma.Decimal;
    emailError?: string | null;
    neto: Prisma.Decimal;
    pdfStorageKey: string | null;
    emailStatus: string;
    deliveryType?: string;
    generatedAt: Date;
    employee?: {
      id: string;
      fullName: string;
      employeeCode: string | null;
      position?: { name: string } | null;
    };
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
    otroConcepto: row.otroConcepto ?? null,
    totalDeducciones: Number(row.totalDeducciones.toString()),
    neto: Number(row.neto.toString()),
    pdfStorageKey: row.pdfStorageKey,
    emailStatus: row.emailStatus,
    emailError: row.emailError ?? null,
    deliveryType: row.deliveryType ?? 'PDF',
    generatedAt: row.generatedAt.toISOString(),
    employee: row.employee
      ? {
          id: row.employee.id,
          fullName: row.employee.fullName,
          employeeCode: row.employee.employeeCode,
          positionName: row.employee.position?.name ?? null,
        }
      : undefined,
  };
}

export { periodFromPayMonth };
