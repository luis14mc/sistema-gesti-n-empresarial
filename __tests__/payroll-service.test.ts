import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockEmployee = {
  id: 'emp-1',
  fullName: 'Test User',
  employeeCode: 'E001',
  email: 'test@example.com',
  hireDate: new Date(2026, 2, 10, 12, 0, 0, 0),
  monthlySalary: { toString: () => '30000' },
  otherDeduction: { toString: () => '0' },
  otherDeductionNote: null,
  payrollEnabled: true,
  isActive: true,
  department: null,
  position: null,
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employee: {
      findFirst: vi.fn(),
    },
    payslip: {
      upsert: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/modules/payroll/application/settings-loader', () => ({
  loadPayrollSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/modules/payroll/infrastructure/payslip-pdf', () => ({
  renderAndStorePayslipPdf: vi.fn().mockResolvedValue('payroll/test.pdf'),
  buildPayslipHtml: vi.fn().mockReturnValue('<html>preview</html>'),
}));

import { prisma } from '@/lib/prisma';
import { generatePayslip, previewPayslip } from '@/modules/payroll/application/payroll-service';

describe('payroll service preview (golden prorated case)', () => {
  beforeEach(() => {
    vi.mocked(prisma.employee.findFirst).mockResolvedValue(mockEmployee as never);
  });

  it('matches primer mes golden case via service layer', async () => {
    const result = await previewPayslip('org-1', 'emp-1', '2026-03');
    expect(result.salarioPeriodo).toBe(22000);
    expect(result.ihss).toBe(595.16);
    expect(result.isr).toBe(410.5);
    expect(result.otro).toBe(0);
    expect(result.neto).toBe(20994.34);
    expect(result.totalDeducciones).toBe(1005.66);
  });

  it('upserts a single payslip row when generating twice for the same period', async () => {
    vi.mocked(prisma.payslip.upsert).mockResolvedValue({
      id: 'ps-1',
      organizationId: 'org-1',
      employeeId: 'emp-1',
      year: 2026,
      month: 3,
      periodStart: new Date('2026-02-20'),
      periodEnd: new Date('2026-03-20'),
      salarioPeriodo: { toString: () => '22000' },
      ihss: { toString: () => '595.16' },
      isr: { toString: () => '410.5' },
      otro: { toString: () => '0' },
      totalDeducciones: { toString: () => '1005.66' },
      neto: { toString: () => '20994.34' },
      pdfStorageKey: 'k.pdf',
      emailStatus: 'NONE',
      generatedAt: new Date(),
      employee: { id: 'emp-1', fullName: 'Test User', employeeCode: 'E001' },
    } as never);

    await generatePayslip('org-1', 'emp-1', '2026-03', 'user-1', { skipPdf: true });
    await generatePayslip('org-1', 'emp-1', '2026-03', 'user-1', { skipPdf: true });

    expect(prisma.payslip.upsert).toHaveBeenCalledTimes(2);
    const where = vi.mocked(prisma.payslip.upsert).mock.calls[0][0].where;
    expect(where).toEqual({
      organizationId_employeeId_year_month: {
        organizationId: 'org-1',
        employeeId: 'emp-1',
        year: 2026,
        month: 3,
      },
    });
  });
});
