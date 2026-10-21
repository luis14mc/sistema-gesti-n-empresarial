import { z } from 'zod';

export const MAINTENANCE_TYPES = ['PREVENTIVE', 'CORRECTIVE', 'UPDATE', 'INSPECTION'] as const;
export const MAINTENANCE_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export const maintenanceCreateSchema = z.object({
  equipmentId: z.string().min(1),
  type: z.enum(MAINTENANCE_TYPES).default('PREVENTIVE'),
  description: z.string().min(1).max(2000),
  scheduledDate: z.coerce.date().optional().nullable(),
  completedDate: z.coerce.date().optional().nullable(),
  cost: z.coerce.number().nonnegative().optional().nullable(),
  technician: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(MAINTENANCE_STATUSES).default('SCHEDULED'),
}).refine(
  (data) => !data.completedDate || !data.scheduledDate || data.completedDate >= data.scheduledDate,
  { message: 'completedDate debe ser >= scheduledDate', path: ['completedDate'] },
);

export const VALID_MAINTENANCE_TRANSITIONS: Record<
  typeof MAINTENANCE_STATUSES[number],
  readonly typeof MAINTENANCE_STATUSES[number][]
> = {
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const maintenanceUpdateSchema = z.object({
  type: z.enum(MAINTENANCE_TYPES).optional(),
  description: z.string().min(1).max(2000).optional(),
  scheduledDate: z.coerce.date().optional().nullable(),
  completedDate: z.coerce.date().optional().nullable(),
  cost: z.coerce.number().nonnegative().optional().nullable(),
  technician: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(MAINTENANCE_STATUSES).optional(),
});
