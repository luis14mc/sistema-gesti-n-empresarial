import { describe, expect, it } from 'vitest';
import { otroDeductionLabel } from '@/modules/payroll/infrastructure/payslip-pdf';

describe('payslip otro concept label', () => {
  it('shows concept in label when provided', () => {
    expect(otroDeductionLabel(100, 'Cooperativa')).toBe('Otro (Cooperativa)');
  });

  it('shows plain Otro when there is amount but no concept', () => {
    expect(otroDeductionLabel(50, null)).toBe('Otra Deducción');
  });
});
