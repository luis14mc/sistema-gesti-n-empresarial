import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockEmployee = {
  id: 'emp-1',
  fullName: 'Test User',
  employeeCode: 'E001',
  email: 'test@example.com',
  hireDate: new Date(2019, 0, 15, 12, 0, 0, 0),
  monthlySalary: { toString: () => '27900' },
  otherDeduction: { toString: () => '999' },
  otherDeductionNote: null,
  payrollEnabled: true,
  isActive: true,
  department: null,
  position: null,
};

const existingOtro = { otro: { toString: () => '581.47' }, otroConcepto: 'Cooperativa' };

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employee: { findFirst: vi.fn() },
    payslip: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/modules/payroll/application/settings-loader', () => ({
  loadPayrollSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/modules/payroll/infrastructure/payslip-pdf', () => ({
  renderAndStorePayslipPdf: vi.fn().mockResolvedValue('payroll/test.pdf'),
  buildPayslipHtml: vi.fn().mockResolvedValue('<html>preview</html>'),
}));

import { prisma } from '@/lib/prisma';
import { generatePayslip, previewPayslip } from '@/modules/payroll/application/payroll-service';
import { payrollFailure } from '@/modules/payroll/application/http';
import { PayrollDomainError } from '@/modules/payroll/domain/errors';

describe('payroll otro overrides', () => {
  beforeEach(() => {
    vi.mocked(prisma.employee.findFirst).mockResolvedValue(mockEmployee as never);
    vi.mocked(prisma.payslip.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.payslip.upsert).mockResolvedValue({
      id: 'ps-1',
      organizationId: 'org-1',
      employeeId: 'emp-1',
      year: 2026,
      month: 9,
      periodStart: new Date('2026-08-20'),
      periodEnd: new Date('2026-09-20'),
      salarioPeriodo: { toString: () => '27900' },
      ihss: { toString: () => '595.16' },
      isr: { toString: () => '786.31' },
      otro: { toString: () => '581.47' },
      otroConcepto: 'Cooperativa',
      totalDeducciones: { toString: () => '1962.94' },
      neto: { toString: () => '25937.06' },
      pdfStorageKey: null,
      emailStatus: 'NONE',
      generatedAt: new Date(),
      employee: { id: 'emp-1', fullName: 'Test User', employeeCode: 'E001' },
    } as never);
  });

  it('uses employee otherDeductionNote when no payslip override exists', async () => {
    vi.mocked(prisma.employee.findFirst).mockResolvedValue({
      ...mockEmployee,
      otherDeduction: { toString: () => '100' },
      otherDeductionNote: 'Cooperativa empleado',
    } as never);

    await generatePayslip('org-1', 'emp-1', '2026-09', 'user-1', { skipPdf: true });

    const lastUpsert = vi.mocked(prisma.payslip.upsert).mock.calls.at(-1)?.[0];
    expect(lastUpsert?.create?.otroConcepto).toBe('Cooperativa empleado');
  });

  it('preserves stored otro and otroConcepto when regenerating without override', async () => {
    vi.mocked(prisma.payslip.findUnique).mockResolvedValue(existingOtro as never);

    await generatePayslip('org-1', 'emp-1', '2026-09', 'user-1', {
      skipPdf: true,
      otroOverride: { otro: 581.47, otroConcepto: 'Cooperativa' },
    });

    await generatePayslip('org-1', 'emp-1', '2026-09', 'user-1', { skipPdf: true });

    const lastUpsert = vi.mocked(prisma.payslip.upsert).mock.calls.at(-1)?.[0];
    expect(Number(lastUpsert?.update?.otro)).toBe(581.47);
    expect(lastUpsert?.update?.otroConcepto).toBe('Cooperativa');
  });

  it('rejects otro greater than salarioPeriodo in preview', async () => {
    await expect(
      previewPayslip('org-1', 'emp-1', '2026-09', { otro: 50_000 }),
    ).rejects.toMatchObject({ code: 'PAYROLL_OTRO_EXCEEDS_SALARY' });
  });

  it('maps PAYROLL_OTRO_EXCEEDS_SALARY to HTTP 400', () => {
    const res = payrollFailure(
      new PayrollDomainError(
        'La deducción "Otro" no puede superar el salario del periodo.',
        'PAYROLL_OTRO_EXCEEDS_SALARY',
      ),
      'req-1',
    );
    expect(res?.status).toBe(400);
  });
});
