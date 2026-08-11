import { z } from 'zod';

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  unreadOnly: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => value === 'true'),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
