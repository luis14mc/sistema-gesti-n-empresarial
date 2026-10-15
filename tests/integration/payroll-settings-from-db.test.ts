import { describe, expect, it, vi, beforeEach } from 'vitest';
import golden from '../fixtures/payroll/golden.json';
import { calculatePayslip } from '@/modules/payroll/domain';
import { PayrollInvalidRateUnitsError } from '@/modules/payroll/domain/errors';

const mockSettingsFindUnique = vi.fn();
const mockBracketsFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    payrollSettings: {
      findUnique: (...args: unknown[]) => mockSettingsFindUnique(...args),
    },
    payrollIsrBracket: {
      findMany: (...args: unknown[]) => mockBracketsFindMany(...args),
    },
  },
}));

import { loadPayrollSettings, payrollSettingsFromDatabase } from '@/modules/payroll/application/settings-loader';

function prismaDecimal(value: string) {
  return { toString: () => value };
}

const productionSettingsRow = {
  medicalExpensesAnnual: prismaDecimal('40000.00'),
  ivmDeductibleMonthly: prismaDecimal('297.58'),
  ihssEmRate: prismaDecimal('2.50'),
  ihssIvmRate: prismaDecimal('2.50'),
  ihssCeilingMonthly: prismaDecimal('11903.13'),
};

/** Same shape and values as migration 20261014120000 / Prisma Decimal in production. */
const productionBracketRows = [
  { order: 1, rate: prismaDecimal('0.00'), toAnnual: prismaDecimal('228324.32') },
  { order: 2, rate: prismaDecimal('15.00'), toAnnual: prismaDecimal('348154.10') },
  { order: 3, rate: prismaDecimal('20.00'), toAnnual: prismaDecimal('809660.75') },
  { order: 4, rate: prismaDecimal('25.00'), toAnnual: prismaDecimal('999999999999.99') },
];

function parseHireDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

describe('loadPayrollSettings from production-shaped DB rows', () => {
  beforeEach(() => {
    mockSettingsFindUnique.mockResolvedValue(productionSettingsRow);
    mockBracketsFindMany.mockResolvedValue(productionBracketRows);
  });

  it('smoke: salario 30000 mar 2026 → ISR 1101.31', async () => {
    const settings = await loadPayrollSettings('org_cni_default', 2026);
    const result = calculatePayslip({
      monthlySalary: 30000,
      hireDate: parseHireDate('2020-01-15'),
      payMonth: '2026-03',
      settings,
    });
    expect(result.isr).toBe(1101.31);
    expect(result.ihss).toBe(595.16);
  });

  it('matches every golden.json case using settings from loadPayrollSettings', async () => {
    const settings = await loadPayrollSettings('org_cni_default', 2026);

    for (const testCase of golden.cases) {
      const result = calculatePayslip({
        monthlySalary: testCase.monthlySalary,
        hireDate: parseHireDate(testCase.hireDate),
        payMonth: testCase.payMonth,
        otherDeductions: testCase.otherDeductions,
        settings,
      });

      expect(result.salarioPeriodo, testCase.id).toBe(testCase.expected.salarioPeriodo);
      expect(result.ihss, testCase.id).toBe(testCase.expected.ihss);
      expect(result.isr, testCase.id).toBe(testCase.expected.isr);
      expect(result.otherDeductions, testCase.id).toBe(testCase.expected.otherDeductions);
      expect(result.netPay, testCase.id).toBe(testCase.expected.netPay);
    }
  });

  it('rejects mixed fraction rates (0.15) from DB', () => {
    expect(() =>
      payrollSettingsFromDatabase(productionSettingsRow, [
        { order: 1, rate: prismaDecimal('0.00'), toAnnual: prismaDecimal('228324.32') },
        { order: 2, rate: prismaDecimal('0.15'), toAnnual: prismaDecimal('348154.10') },
      ]),
    ).toThrow(PayrollInvalidRateUnitsError);
  });
});
