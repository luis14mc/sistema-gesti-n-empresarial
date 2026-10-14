export interface PayPeriod {
  start: Date;
  end: Date;
  year: number;
  /** 1–12 */
  month: number;
}

export interface IhssSettings {
  emRate: number;
  ivmRate: number;
  ceilingMonthly: number;
}

export interface IsrBracket {
  rate: number;
  from: number;
  to: number;
}

export interface IsrSettings {
  medicalExpensesAnnual: number;
  ivmDeductibleMonthly: number;
  brackets: IsrBracket[];
}

export interface PayrollSettings {
  ihss: IhssSettings;
  isr: IsrSettings;
}

export interface PayslipInput {
  monthlySalary: number;
  hireDate: Date;
  /** Pay month in `YYYY-MM` format (period ends on day 20 of this month). */
  payMonth: string;
  otherDeductions?: number;
  settings?: PayrollSettings;
}

export interface PayslipResult {
  payPeriod: PayPeriod;
  salarioPeriodo: number;
  ihss: number;
  isr: number;
  otherDeductions: number;
  netPay: number;
  monthsWorkedInYear: number;
  isPrimerMes: boolean;
}
