import { describe, expect, it } from 'vitest';
import { calculatePayslip, periodFromPayMonth, monthsWorkedInYear } from '@/modules/payroll/domain';
import { EmployeeNotYetHiredError } from '@/modules/payroll/domain/errors';

function d(iso: string): Date {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, m - 1, day, 12, 0, 0, 0);
}

describe('payroll period 20–20', () => {
  it('maps 2026-03 to 20/02/2026–20/03/2026', () => {
    const p = periodFromPayMonth('2026-03');
    expect(p.start.getFullYear()).toBe(2026);
    expect(p.start.getMonth()).toBe(1);
    expect(p.start.getDate()).toBe(20);
    expect(p.end.getMonth()).toBe(2);
    expect(p.end.getDate()).toBe(20);
    expect(p.year).toBe(2026);
    expect(p.month).toBe(3);
  });

  it('handles January pay month crossing year boundary', () => {
    const p = periodFromPayMonth('2026-01');
    expect(p.start.getFullYear()).toBe(2025);
    expect(p.start.getMonth()).toBe(11);
    expect(p.start.getDate()).toBe(20);
  });
});

describe('monthsWorkedInYear', () => {
  it('returns 0 when hire is after the pay year', () => {
    expect(monthsWorkedInYear(d('2027-01-01'), 2026)).toBe(0);
  });

  it('returns 12 when hired before the year', () => {
    expect(monthsWorkedInYear(d('2019-06-01'), 2026)).toBe(12);
  });

  it('returns remaining months when hired mid-year', () => {
    expect(monthsWorkedInYear(d('2026-07-01'), 2026)).toBe(6);
  });

  it('returns 0 when hire month is after the pay month in the same year', () => {
    expect(monthsWorkedInYear(d('2026-07-01'), 2026, 3)).toBe(0);
  });
});

describe('calculation edges', () => {
  it('throws EMPLOYEE_NOT_YET_HIRED when n=0 (no division by zero)', () => {
    expect(() =>
      calculatePayslip({
        monthlySalary: 30000,
        hireDate: d('2027-01-15'),
        payMonth: '2026-03',
      }),
    ).toThrow(EmployeeNotYetHiredError);
  });

  it('throws when hire is later in the same year than the pay month', () => {
    expect(() =>
      calculatePayslip({
        monthlySalary: 30000,
        hireDate: d('2026-09-01'),
        payMonth: '2026-03',
      }),
    ).toThrow(EmployeeNotYetHiredError);
  });

  it('prorates hire on day 1 of period month (31/30 × salario)', () => {
    const result = calculatePayslip({
      monthlySalary: 30000,
      hireDate: d('2026-03-01'),
      payMonth: '2026-03',
    });
    expect(result.salarioPeriodo).toBe(31000);
  });

  it('uses full salary when hire predates the pay period', () => {
    const result = calculatePayslip({
      monthlySalary: 30000,
      hireDate: d('2020-01-15'),
      payMonth: '2026-03',
    });
    expect(result.salarioPeriodo).toBe(30000);
  });

  it('prorates hire on last day of March (31 days)', () => {
    const result = calculatePayslip({
      monthlySalary: 30000,
      hireDate: d('2026-03-31'),
      payMonth: '2026-03',
    });
    expect(result.salarioPeriodo).toBe(1000);
  });
});
