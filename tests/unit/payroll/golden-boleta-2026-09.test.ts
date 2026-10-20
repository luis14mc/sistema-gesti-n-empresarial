import { describe, expect, it } from 'vitest';
import { calculatePayslip, periodFromPayMonth } from '@/modules/payroll/domain';
import { mapPayslipAmounts } from '@/modules/payroll/application/mappers';

function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

describe('golden boleta Septiembre 2026 (CNI v2.2.0)', () => {
  it('matches official payroll amounts and period boundaries', () => {
    const payMonth = '2026-09';
    const result = calculatePayslip({
      monthlySalary: 27_900,
      hireDate: parseLocalDate('2019-01-15'),
      payMonth,
      otherDeductions: 581.47,
    });
    const amounts = mapPayslipAmounts(result);

    expect(result.ihss).toBe(595.16);
    expect(result.isr).toBe(786.31);
    expect(result.otherDeductions).toBe(581.47);
    expect(amounts.totalDeducciones).toBe(1962.94);
    expect(result.netPay).toBe(25_937.06);

    const period = periodFromPayMonth(payMonth);
    expect(period.start.getFullYear()).toBe(2026);
    expect(period.start.getMonth()).toBe(7);
    expect(period.start.getDate()).toBe(20);
    expect(period.end.getFullYear()).toBe(2026);
    expect(period.end.getMonth()).toBe(8);
    expect(period.end.getDate()).toBe(20);
  });
});
