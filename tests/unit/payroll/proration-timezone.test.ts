import { describe, expect, it } from 'vitest';
import { calculatePayslip } from '@/modules/payroll/domain';

describe('payroll hire dates (@db.Date midnight UTC)', () => {
  it('does not shift hire day under America/Tegucigalpa when using UTC calendar parts', () => {
    const previousTz = process.env.TZ;
    process.env.TZ = 'America/Tegucigalpa';
    try {
      const hireDate = new Date('2026-02-17T00:00:00.000Z');
      const result = calculatePayslip({
        monthlySalary: 27500,
        hireDate,
        payMonth: '2026-02',
        otherDeductions: 0,
      });
      expect(result.salarioPeriodo).toBe(11000);
      expect(result.ihss).toBe(550);
      expect(result.isr).toBe(241.85);
      expect(result.netPay).toBe(10208.15);
    } finally {
      if (previousTz === undefined) delete process.env.TZ;
      else process.env.TZ = previousTz;
    }
  });
});
