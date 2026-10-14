import type { IhssSettings, IsrSettings } from './types';

/** Honduras payroll defaults for fiscal year 2026 (CNI v2.2.0). */
export const PAYROLL_YEAR = 2026;

export const DEFAULT_MEDICAL_EXPENSES_ANNUAL = 40_000;

/** IVM portion deductible from ISR (monthly), Art. 22 ISR. */
export const DEFAULT_IVM_DEDUCTIBLE_MONTHLY = 297.58;

export const DEFAULT_IHSS_SETTINGS: IhssSettings = {
  emRate: 2.5,
  ivmRate: 2.5,
  ceilingMonthly: 11_903.13,
};

export const DEFAULT_ISR_BRACKETS_2026 = [
  { rate: 0, from: 0.01, to: 228_324.32 },
  { rate: 0.15, from: 228_324.33, to: 348_154.1 },
  { rate: 0.2, from: 348_154.11, to: 809_660.75 },
  { rate: 0.25, from: 809_660.76, to: Number.POSITIVE_INFINITY },
] as const;

export const DEFAULT_ISR_SETTINGS: IsrSettings = {
  medicalExpensesAnnual: DEFAULT_MEDICAL_EXPENSES_ANNUAL,
  ivmDeductibleMonthly: DEFAULT_IVM_DEDUCTIBLE_MONTHLY,
  brackets: DEFAULT_ISR_BRACKETS_2026.map((b) => ({ ...b })),
};

export const DEFAULT_PAYROLL_SETTINGS = {
  ihss: DEFAULT_IHSS_SETTINGS,
  isr: DEFAULT_ISR_SETTINGS,
} as const;
