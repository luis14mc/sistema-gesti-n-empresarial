import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCompareReportRows,
  diffPayrollRows,
  formatCompareCsv,
  parseLegacyPayrollCsv,
  parsePayMonth,
} from '../../scripts/payroll/compare-month-core';

const fixturePath = resolve(__dirname, '../fixtures/payroll-legacy-sample.csv');

describe('payroll compare-month (legacy CSV vs SGE)', () => {
  it('parsePayMonth accepts YYYY-MM', () => {
    expect(parsePayMonth('2026-03')).toEqual({ year: 2026, month: 3, label: '2026-03' });
  });

  it('parses sample CSV and detects field differences above L 0.01', () => {
    const legacyByCode = parseLegacyPayrollCsv(readFileSync(fixturePath, 'utf8'));
    const sgeByCode = new Map([
      [
        'EMP-001',
        { salario: 15000, ihss: 375, isr: 1200, otro: 0, neto: 13425 },
      ],
      [
        'EMP-002',
        { salario: 12000, ihss: 300, isr: 850, otro: 50, neto: 10800 },
      ],
    ]);

    const { diffs, compared, matches } = buildCompareReportRows(legacyByCode, sgeByCode);
    expect(compared).toBe(2);
    expect(matches).toBe(1);
    expect(diffs).toHaveLength(2);
    expect(diffs[0]).toMatchObject({ codigo: 'EMP-002', campo: 'isr', anterior: 800, sge: 850 });
    expect(diffs[1]).toMatchObject({ codigo: 'EMP-002', campo: 'neto', anterior: 10850, sge: 10800 });

    const csv = formatCompareCsv(diffs);
    expect(csv).toContain('codigo,campo,sge,anterior,diferencia');
    expect(csv).toContain('EMP-002,isr,850.00,800.00,50.00');
  });

  it('ignores differences within one cent', () => {
    const legacy = {
      codigo: 'X',
      salario: 100,
      ihss: 10,
      isr: 5,
      otro: 0,
      neto: 85,
    };
    const sge = { salario: 100.005, ihss: 10, isr: 5, otro: 0, neto: 85.005 };
    expect(diffPayrollRows('X', legacy, sge)).toEqual([]);
  });
});
