import type { NotificationChannel } from '@prisma/client';

export class NotificationNotFoundError extends Error {
  readonly name = 'NotificationNotFoundError';
  readonly code = 'NOTIFICATION_NOT_FOUND';
  readonly status = 404;
  readonly details: Readonly<{ notificationId: string; organizationId: string }>;
  constructor(notificationId: string, organizationId: string) {
    super(`Notification ${notificationId} not found in organization ${organizationId}.`);
    this.details = Object.freeze({ notificationId, organizationId });
  }
}

export class NotificationOwnershipError extends Error {
  readonly name = 'NotificationOwnershipError';
  readonly code = 'NOTIFICATION_OWNERSHIP_DENIED';
  readonly status = 403;
  readonly details: Readonly<{ notificationId: string; userId: string }>;
  constructor(notificationId: string, userId: string) {
    super(`User ${userId} cannot operate on notification ${notificationId}.`);
    this.details = Object.freeze({ notificationId, userId });
  }
}

export class InvalidNotificationActionUrlError extends Error {
  readonly name = 'InvalidNotificationActionUrlError';
  readonly code = 'INVALID_NOTIFICATION_ACTION_URL';
  readonly status = 422;
  readonly details: Readonly<{ actionUrl: string }>;
  constructor(actionUrl: string) {
    super(`Notification action URL is not a safe internal route: ${actionUrl}`);
    this.details = Object.freeze({ actionUrl });
  }
}

export class UnsupportedNotificationChannelError extends Error {
  readonly name = 'UnsupportedNotificationChannelError';
  readonly code = 'UNSUPPORTED_NOTIFICATION_CHANNEL';
  readonly status = 422;
  readonly details: Readonly<{ channel: NotificationChannel; phase: string }>;
  constructor(channel: NotificationChannel, phase: string) {
    super(`Channel ${channel} is not supported in phase ${phase}.`);
    this.details = Object.freeze({ channel, phase });
  }
}

export function isNotificationDomainError(error: unknown): boolean {
  return error instanceof Error && [
    NotificationNotFoundError,
    NotificationOwnershipError,
    InvalidNotificationActionUrlError,
    UnsupportedNotificationChannelError,
  ].some((ctor) => error instanceof ctor);
}
