import { describe, expect, it } from 'vitest';
import golden from '../../fixtures/payroll/golden.json';
import { calculatePayslip } from '@/modules/payroll/domain';

function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

describe('payroll calculation golden cases', () => {
  for (const testCase of golden.cases) {
    it(testCase.id, () => {
      const result = calculatePayslip({
        monthlySalary: testCase.monthlySalary,
        hireDate: parseLocalDate(testCase.hireDate),
        payMonth: testCase.payMonth,
        otherDeductions: testCase.otherDeductions,
      });

      expect(result.salarioPeriodo).toBe(testCase.expected.salarioPeriodo);
      expect(result.ihss).toBe(testCase.expected.ihss);
      expect(result.isr).toBe(testCase.expected.isr);
      expect(result.otherDeductions).toBe(testCase.expected.otherDeductions);
      expect(result.netPay).toBe(testCase.expected.netPay);
    });
  }
});
