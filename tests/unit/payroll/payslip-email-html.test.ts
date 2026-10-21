import { describe, expect, it } from 'vitest';
import { buildPayslipEmail } from '@/modules/payroll/infrastructure/payslip-email-html';

const base = {
  employeeName: 'Luis <b>Martínez</b>',
  periodStart: new Date(2026, 7, 20, 12),
  periodEnd: new Date(2026, 8, 20, 12),
  salarioPeriodo: 27_900,
  ihss: 595.16,
  isr: 786.31,
  otro: 581.47,
  otroConcepto: 'Ajuste ISR',
  totalDeducciones: 1962.94,
  neto: 25_937.06,
  year: 2026,
};

describe('payslip email (CNI v2.2.0 template)', () => {
  it('uses the original subject and amounts table', () => {
    const mail = buildPayslipEmail(base);
    expect(mail.subject).toBe('Boleta de Pago - 20/08/2026 al 20/09/2026');
    expect(mail.html).toContain('CONSEJO NACIONAL DE INVERSIONES');
    expect(mail.html).toContain('-L. 595.16');
    expect(mail.html).toContain('-L. 786.31');
    expect(mail.html).toContain('Otro (Ajuste ISR)');
    expect(mail.html).toContain('-L. 1,962.94');
    expect(mail.html).toContain('L. 25,937.06');
    expect(mail.html).toContain('color-scheme" content="light only"');
  });

  it('escapes the employee name and omits otro when zero', () => {
    const mail = buildPayslipEmail({ ...base, otro: 0 });
    expect(mail.html).toContain('Luis &lt;b&gt;Martínez&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>Martínez</b>');
    expect(mail.html).not.toContain('Ajuste ISR');
  });
});
