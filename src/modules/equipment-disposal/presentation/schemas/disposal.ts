import { z } from 'zod';

export const disposalEvaluationSchema = z.object({
  equipmentId: z.string().min(1),
  purchaseDate: z.coerce.date(),
  purchasePrice: z.coerce.number().nonnegative(),
  estimatedRepairCost: z.coerce.number().nonnegative(),
  estimatedReplacementPrice: z.coerce.number().positive(),
  physicalCondition: z.enum(['EXCELLENT', 'ACCEPTABLE', 'FAIR', 'POOR', 'CRITICAL']),
  functionalCondition: z.enum(['OPERATIONAL', 'SLOW', 'FREQUENT_FAILURES', 'INOPERABLE']),
  securitySupportStatus: z.enum(['SUPPORTED', 'LIMITED_SUPPORT', 'UNSUPPORTED', 'VULNERABLE']),
  technicalNotes: z.string().trim().max(10000).optional(),
  version: z.number().int().positive().optional(),
});

export const disposalReasonSchema = z.object({
  reason: z.string().trim().min(5).max(2000),
});

export const updateDisposalSchema = disposalEvaluationSchema.extend({
  version: z.number().int().positive(),
});

export type DisposalEvaluationInput = z.infer<typeof disposalEvaluationSchema>;
