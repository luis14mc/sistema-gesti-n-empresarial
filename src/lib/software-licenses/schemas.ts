import { z } from 'zod';
import { SOFTWARE_BILLING_CYCLES, SOFTWARE_CURRENCIES } from './billing';
import { SEAT_STATUSES, SEAT_TYPES } from './seats';

const money = z.coerce.number().min(0).max(1_000_000_000);
const day = z.coerce.number().int().min(1).max(31);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalEmail = z.union([z.string().trim().email(), z.literal(''), z.null()]).optional();

const subscriptionFields = z.object({
  productName: z.string().trim().min(2).max(120),
  vendor: z.string().trim().max(120).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  website: z.string().trim().max(300).optional().nullable(),
  planName: z.string().trim().min(2).max(120),
  totalSeats: z.coerce.number().int().min(1).max(10000),
  billingCycle: z.enum(SOFTWARE_BILLING_CYCLES),
  currency: z.enum(SOFTWARE_CURRENCIES),
  billingAmount: money,
  startDate: isoDate,
  renewalDate: isoDate.optional().nullable(),
  paymentDay: day.optional().nullable(),
  autoRenew: z.boolean().default(true),
  notes: z.string().trim().max(2000).optional().nullable(),
  expiringSoonDays: z.coerce.number().int().min(1).max(365).default(30),
});

export const createSubscriptionSchema = subscriptionFields.superRefine((value, ctx) => {
  if (value.renewalDate && value.startDate && value.renewalDate < value.startDate) {
    ctx.addIssue({ code: 'custom', path: ['renewalDate'], message: 'La renovación no puede ser anterior al inicio.' });
  }
});

export const updateSubscriptionSchema = subscriptionFields.partial().extend({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED']).optional(),
  active: z.boolean().optional(),
});

export const createSeatSchema = z.object({
  accountEmail: optionalEmail,
  accountIdentifier: z.string().trim().max(120).optional().nullable(),
  seatType: z.enum(SEAT_TYPES).default('INDIVIDUAL'),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const updateSeatSchema = z.object({
  accountEmail: optionalEmail,
  accountIdentifier: z.string().trim().max(120).optional().nullable(),
  seatType: z.enum(SEAT_TYPES).optional(),
  status: z.enum(SEAT_STATUSES).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const assignSeatSchema = z.object({
  employeeId: z.string().min(1),
  notes: z.string().trim().max(1000).optional().nullable(),
  replaceAssignmentId: z.string().min(1).optional(),
});

export const licenseListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRING_SOON', 'EXPIRED']).optional(),
  seatType: z.enum(SEAT_TYPES).optional(),
  vendor: z.string().trim().optional(),
  renewal: z.enum(['IN_7_DAYS', 'IN_15_DAYS', 'IN_30_DAYS', 'EXPIRED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
