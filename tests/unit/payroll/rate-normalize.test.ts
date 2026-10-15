import { describe, expect, it } from 'vitest';
import { calculatePayslip } from '@/modules/payroll/domain';
import { DEFAULT_PAYROLL_SETTINGS } from '@/modules/payroll/domain/constants';

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe('payroll rate normalization (CNI server.py parity)', () => {
  it('treats ISR bracket rates stored as 15 like 0.15', () => {
    const hire = d('2020-01-15');
    const decimalSettings = structuredClone(DEFAULT_PAYROLL_SETTINGS);
    const percentSettings = structuredClone(DEFAULT_PAYROLL_SETTINGS);
    percentSettings.isr.brackets = percentSettings.isr.brackets.map((b) => ({
      ...b,
      rate: b.rate === 0 ? 0 : b.rate * 100,
    }));

    const expected = calculatePayslip({
      monthlySalary: 30000,
      hireDate: hire,
      payMonth: '2026-03',
      settings: decimalSettings,
    });

    const withPercentRates = calculatePayslip({
      monthlySalary: 30000,
      hireDate: hire,
      payMonth: '2026-03',
      settings: percentSettings,
    });

    expect(withPercentRates.isr).toBe(expected.isr);
    expect(withPercentRates.ihss + withPercentRates.isr).toBeLessThanOrEqual(
      withPercentRates.salarioPeriodo,
    );
  });

  it('never exceeds period salary for default golden salaries with mis-stored IHSS 250', () => {
    const settings = structuredClone(DEFAULT_PAYROLL_SETTINGS);
    settings.ihss.emRate = 250;
    settings.ihss.ivmRate = 250;
    const result = calculatePayslip({
      monthlySalary: 30000,
      hireDate: d('2020-01-15'),
      payMonth: '2026-03',
      settings,
    });
    expect(result.ihss).toBeCloseTo(595.16, 2);
    expect(result.ihss + result.isr + result.otherDeductions).toBeLessThan(result.salarioPeriodo);
  });
});
