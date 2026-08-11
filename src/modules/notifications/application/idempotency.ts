import { createHash } from 'node:crypto';
import type { NotificationChannel } from '@prisma/client';
import type { NotificationEventType } from '../domain/notification-types';

export type IdempotencyKeyInput = Readonly<{
  organizationId: string;
  eventType: NotificationEventType;
  aggregateId: string;
  recipientId: string | null;
  channel: NotificationChannel;
  eventId?: string | null;
}>;

export function buildIdempotencyKey(input: IdempotencyKeyInput): string {
  const parts = [
    input.organizationId,
    input.eventType,
    input.aggregateId,
    input.recipientId ?? '*',
    input.channel,
    input.eventId ?? '',
  ];
  const digest = createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
  return `${input.eventType}:${input.channel}:${digest}`;
}
