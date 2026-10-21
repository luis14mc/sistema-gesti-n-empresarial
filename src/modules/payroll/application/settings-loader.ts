import {
  countIsrBrackets,
  createIsrBrackets,
  createPayrollSettings,
  findPayrollSettings,
  findPayrollSettingsOrThrow,
  listIsrBrackets,
  replaceIsrBrackets,
  updatePayrollSettings,
} from '@/modules/payroll/infrastructure/payroll-settings-repository';
import {
  DEFAULT_IHSS_SETTINGS,
  DEFAULT_ISR_SETTINGS,
  PAYROLL_YEAR,
  assertIsrRatesArePercentUnits,
} from '@/modules/payroll/domain';
import {
  DEFAULT_MEDICAL_EXPENSES_ANNUAL,
  DEFAULT_IVM_DEDUCTIBLE_MONTHLY,
} from '@/modules/payroll/domain/constants';
import type { IsrBracket, PayrollSettings } from '@/modules/payroll/domain';
function decimalToNumber(value: { toString(): string } | number | null | undefined, fallback: number): number {
  if (value === null || value === undefined) return fallback;
  return Number(value.toString());
}

export type PayrollIsrBracketRow = {
  order: number;
  rate: { toString(): string };
  toAnnual: { toString(): string };
};

export type PayrollSettingsRow = {
  medicalExpensesAnnual: { toString(): string };
  ivmDeductibleMonthly: { toString(): string };
  ihssEmRate: { toString(): string };
  ihssIvmRate: { toString(): string };
  ihssCeilingMonthly: { toString(): string };
};

export function bracketsFromRows(rows: PayrollIsrBracketRow[]): IsrBracket[] {
  const sorted = [...rows].sort((a, b) => a.order - b.order);
  const rates = sorted.map((row) => Number(row.rate.toString()));
  assertIsrRatesArePercentUnits(rates);

  let from = 0.01;
  return sorted.map((row, index) => {
    const to = Number(row.toAnnual.toString());
    const bracket: IsrBracket = {
      rate: rates[index],
      from,
      to: Number.isFinite(to) ? to : Number.POSITIVE_INFINITY,
    };
    from = to + 0.01;
    return bracket;
  });
}

export function payrollSettingsFromDatabase(
  settingsRow: PayrollSettingsRow | null,
  bracketRows: PayrollIsrBracketRow[],
): PayrollSettings {
  const ihss = settingsRow
    ? {
        emRate: decimalToNumber(settingsRow.ihssEmRate, DEFAULT_IHSS_SETTINGS.emRate),
        ivmRate: decimalToNumber(settingsRow.ihssIvmRate, DEFAULT_IHSS_SETTINGS.ivmRate),
        ceilingMonthly: decimalToNumber(settingsRow.ihssCeilingMonthly, DEFAULT_IHSS_SETTINGS.ceilingMonthly),
      }
    : { ...DEFAULT_IHSS_SETTINGS };

  const brackets =
    bracketRows.length > 0
      ? bracketsFromRows(bracketRows)
      : DEFAULT_ISR_SETTINGS.brackets.map((b) => ({ ...b }));

  const isr = {
    medicalExpensesAnnual: settingsRow
      ? decimalToNumber(settingsRow.medicalExpensesAnnual, DEFAULT_MEDICAL_EXPENSES_ANNUAL)
      : DEFAULT_MEDICAL_EXPENSES_ANNUAL,
    ivmDeductibleMonthly: settingsRow
      ? decimalToNumber(settingsRow.ivmDeductibleMonthly, DEFAULT_IVM_DEDUCTIBLE_MONTHLY)
      : DEFAULT_IVM_DEDUCTIBLE_MONTHLY,
    brackets,
  };

  return { ihss, isr };
}

export async function loadPayrollSettings(
  organizationId: string,
  year: number = PAYROLL_YEAR,
): Promise<PayrollSettings> {
  const [settingsRow, bracketRows] = await Promise.all([
    findPayrollSettings(organizationId),
    listIsrBrackets(organizationId, year),
  ]);

  return payrollSettingsFromDatabase(settingsRow, bracketRows);
}

export async function getPayrollSettingsRecord(organizationId: string) {
  await ensureDefaultPayrollSettings(organizationId);
  const row = await findPayrollSettingsOrThrow(organizationId);
  return {
    medicalExpensesAnnual: Number(row.medicalExpensesAnnual.toString()),
    ivmDeductibleMonthly: Number(row.ivmDeductibleMonthly.toString()),
    ihssEmRate: Number(row.ihssEmRate.toString()),
    ihssIvmRate: Number(row.ihssIvmRate.toString()),
    ihssCeilingMonthly: Number(row.ihssCeilingMonthly.toString()),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updatePayrollSettingsRecord(
  organizationId: string,
  data: {
    medicalExpensesAnnual?: number;
    ivmDeductibleMonthly?: number;
    ihssEmRate?: number;
    ihssIvmRate?: number;
    ihssCeilingMonthly?: number;
  },
  updatedById?: string,
) {
  await ensureDefaultPayrollSettings(organizationId, updatedById);
  const row = await updatePayrollSettings(organizationId, {
    ...data,
    updatedById,
  });
  return {
    medicalExpensesAnnual: Number(row.medicalExpensesAnnual.toString()),
    ivmDeductibleMonthly: Number(row.ivmDeductibleMonthly.toString()),
    ihssEmRate: Number(row.ihssEmRate.toString()),
    ihssIvmRate: Number(row.ihssIvmRate.toString()),
    ihssCeilingMonthly: Number(row.ihssCeilingMonthly.toString()),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listIsrBracketRecords(organizationId: string, year: number) {
  await ensureDefaultPayrollSettings(organizationId);
  const rows = await listIsrBrackets(organizationId, year);
  if (rows.length === 0) {
    return DEFAULT_ISR_SETTINGS.brackets.map((b, index) => ({
      order: index + 1,
      rate: b.rate,
      toAnnual: Number.isFinite(b.to) ? b.to : 999_999_999_999,
    }));
  }
  return rows.map((r) => ({
    id: r.id,
    order: r.order,
    rate: Number(r.rate.toString()),
    toAnnual: Number(r.toAnnual.toString()),
  }));
}

export async function replaceIsrBracketRecords(
  organizationId: string,
  year: number,
  brackets: Array<{ order: number; rate: number; toAnnual: number }>,
) {
  assertIsrRatesArePercentUnits(brackets.map((b) => b.rate));
  await replaceIsrBrackets(
    organizationId,
    year,
    brackets.map((b) => ({
      organizationId,
      year,
      order: b.order,
      rate: b.rate,
      toAnnual: b.toAnnual,
    })),
  );
  return listIsrBracketRecords(organizationId, year);
}

export async function ensureDefaultPayrollSettings(organizationId: string, updatedById?: string): Promise<void> {
  const existing = await findPayrollSettings(organizationId);
  if (existing) return;

  await createPayrollSettings({
      organizationId,
      medicalExpensesAnnual: DEFAULT_MEDICAL_EXPENSES_ANNUAL,
      ivmDeductibleMonthly: DEFAULT_IVM_DEDUCTIBLE_MONTHLY,
      ihssEmRate: DEFAULT_IHSS_SETTINGS.emRate,
      ihssIvmRate: DEFAULT_IHSS_SETTINGS.ivmRate,
      ihssCeilingMonthly: DEFAULT_IHSS_SETTINGS.ceilingMonthly,
      updatedById,
  });

  const bracketCount = await countIsrBrackets(organizationId, PAYROLL_YEAR);
  if (bracketCount > 0) return;

  await createIsrBrackets(
    DEFAULT_ISR_SETTINGS.brackets.map((b, index) => ({
      organizationId,
      year: PAYROLL_YEAR,
      order: index + 1,
      rate: b.rate,
      toAnnual: Number.isFinite(b.to) ? b.to : 999_999_999_999,
    })),
  );
}
