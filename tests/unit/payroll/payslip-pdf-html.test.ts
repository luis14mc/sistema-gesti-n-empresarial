import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/compras/institution', () => ({
  resolveInstitutionLogoDataUri: vi.fn(async () => 'data:image/png;base64,abc'),
}));

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

  it('escapes HTML in employee fields', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });
});
