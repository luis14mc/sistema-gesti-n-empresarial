import { z } from 'zod';

export const equipmentListQuerySchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
