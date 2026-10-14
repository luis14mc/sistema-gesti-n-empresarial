import { moneyNumber, toDecimal } from '@/modules/payroll/domain/decimal';
import type { PayslipResult } from '@/modules/payroll/domain/types';

export interface PayslipApiAmounts {
  salarioPeriodo: number;
  ihss: number;
  isr: number;
  otro: number;
  totalDeducciones: number;
  neto: number;
}

export function mapPayslipAmounts(result: PayslipResult): PayslipApiAmounts {
  const totalDeducciones = moneyNumber(
    toDecimal(result.ihss).plus(result.isr).plus(result.otherDeductions),
  );
  return {
    salarioPeriodo: result.salarioPeriodo,
    ihss: result.ihss,
    isr: result.isr,
    otro: result.otherDeductions,
    totalDeducciones,
    neto: result.netPay,
  };
}

export function formatLempiras(amount: number): string {
  return `L. ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
