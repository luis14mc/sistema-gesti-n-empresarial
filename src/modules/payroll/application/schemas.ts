import { z } from 'zod';

export const payMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use formato YYYY-MM');

export const previewPayslipSchema = z.object({
  employeeId: z.string().min(1),
  payMonth: payMonthSchema,
});

export const generatePayslipSchema = previewPayslipSchema;

export const batchPayslipSchema = z.object({
  payMonth: payMonthSchema,
  /** If omitted, all active employees with payrollEnabled are processed. */
  employeeIds: z.array(z.string().min(1)).max(500).optional(),
});

export const patchPayrollEmployeeSchema = z.object({
  monthlySalary: z.number().nonnegative().nullable().optional(),
  otherDeduction: z.number().nonnegative().optional(),
  otherDeductionNote: z.string().max(500).nullable().optional(),
  payrollEnabled: z.boolean().optional(),
});

export const payrollSettingsPatchSchema = z.object({
  medicalExpensesAnnual: z.number().nonnegative().optional(),
  ivmDeductibleMonthly: z.number().nonnegative().optional(),
  ihssEmRate: z.number().nonnegative().optional(),
  ihssIvmRate: z.number().nonnegative().optional(),
  ihssCeilingMonthly: z.number().nonnegative().optional(),
});

export const isrBracketInputSchema = z.object({
  order: z.number().int().positive(),
  rate: z.number().min(0).max(100),
  toAnnual: z.number().nonnegative(),
});

export const isrBracketsPutSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  brackets: z.array(isrBracketInputSchema).min(1).max(20),
});
