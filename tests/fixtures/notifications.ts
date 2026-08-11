import type { NotificationChannel, NotificationStatus } from '@prisma/client';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

export function resetNotificationFactoryCounters(): void {
  counter = 0;
}

export type TestNotification = Readonly<{
  id: string;
  organizationId: string;
  userId: string | null;
  eventType: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  body: string;
  actionUrl: string | null;
  idempotencyKey: string;
  readAt: Date | null;
}>;

export function seedNotification(overrides: Partial<TestNotification> & { organizationId: string }): TestNotification {
  const id = overrides.id ?? nextId('notif');
  return {
    id,
    organizationId: overrides.organizationId,
    userId: overrides.userId ?? null,
    eventType: overrides.eventType ?? 'organization.lifecycle.suspended',
    channel: overrides.channel ?? 'IN_APP',
    status: overrides.status ?? 'SENT',
    title: overrides.title ?? 'Test notification',
    body: overrides.body ?? 'Notification body for tests.',
    actionUrl: overrides.actionUrl ?? '/ajustes/organizacion',
    idempotencyKey: overrides.idempotencyKey ?? `test:${id}`,
    readAt: overrides.readAt ?? null,
  };
}
