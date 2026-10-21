import { describe, expect, it } from 'vitest';

import { buildPayslipHtml, escapeHtml, otroDeductionLabel } from '@/modules/payroll/infrastructure/payslip-pdf';

const baseInput = {
  organizationId: 'org-1',
  employeeId: 'emp-1',
  employeeName: 'Juan Pérez',
  employeeCode: 'CNI008',
  employeeEmail: 'juan@cni.hn',
  positionName: 'Analista',
  year: 2026,
  month: 9,
  periodStart: new Date(2026, 7, 20, 12),
  periodEnd: new Date(2026, 8, 20, 12),
  salarioPeriodo: 27_900,
  ihss: 595.16,
  isr: 786.31,
  otro: 581.47,
  otroConcepto: 'Préstamo <interno>',
  totalDeducciones: 1962.94,
  neto: 25_937.06,
  generatedAt: new Date('2026-09-21T15:30:00-06:00'),
};

describe('payslip PDF HTML', () => {
  it('includes sections, formatted amounts, and escaped otro concept', async () => {
    const html = await buildPayslipHtml(baseInput);
    expect(html).toContain('BOLETA DE PAGO');
    expect(html).toContain('DATOS DEL EMPLEADO');
    expect(html).toContain('INGRESOS');
    expect(html).toContain('DEDUCCIONES');
    expect(html).toContain('SALARIO NETO');
    expect(html).toContain('L. 27,900.00');
    expect(html).toContain('-L. 1,962.94');
    expect(html).toContain('L. 25,937.06');
    expect(html).toContain('IHSS (Seguro Social)');
    expect(html).toContain('Otro (Préstamo &lt;interno&gt;)');
    expect(html).not.toContain('Otro (Préstamo <interno>)');
  });

  it('omits otro row when amount is zero', async () => {
    const html = await buildPayslipHtml({ ...baseInput, otro: 0, otroConcepto: 'X' });
    expect(html).not.toContain('Otro (X)');
    expect(otroDeductionLabel(0, 'X')).toBeNull();
  });

  it('matches the CNI v2.2.0 layout: palette, A4 full-bleed header and original logo (not inverted)', async () => {
    const html = await buildPayslipHtml(baseInput);
    expect(html).toContain('size: A4 portrait; margin: 0');
    for (const color of ['#233981', '#2aaad6', '#1bae64', '#b42828']) expect(html).toContain(color);
    expect(html).not.toMatch(/invert\(/);
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('Código:');
    expect(html).toContain('Salario Mensual');
  });

  it('labels prorated first-month salary like the original', async () => {
    const html = await buildPayslipHtml({ ...baseInput, isProrated: true });
    expect(html).toContain('Salario (prorrateado por días trabajados)');
  });

  it('escapes HTML in employee fields', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });
});
