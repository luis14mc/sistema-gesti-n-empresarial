import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener letras minúsculas, números y guiones.')
    .optional(),
  legalName: z.string().trim().max(200).optional().nullable(),
  rtn: z.string().trim().max(40).optional().nullable(),
  timezone: z.string().trim().min(2).max(64).optional(),
  locale: z.string().trim().min(2).max(16).optional(),
  currency: z.string().trim().min(2).max(8).optional(),
  primaryContactName: z.string().trim().max(200).optional().nullable(),
  primaryContactEmail: z.string().trim().email().max(254).optional().nullable(),
  primaryContactPhone: z.string().trim().max(40).optional().nullable(),
});

export type CreateOrganizationInputSchema = z.infer<typeof createOrganizationSchema>;

export const organizationLifecycleReasonSchema = z.object({
  reason: z.string().trim().min(5).max(2000),
});

export type OrganizationLifecycleReason = z.infer<typeof organizationLifecycleReasonSchema>;

export const organizationListQuerySchema = z.object({
  status: z
    .enum(['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED', 'PENDING_DELETION', 'INACTIVE'])
    .optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
