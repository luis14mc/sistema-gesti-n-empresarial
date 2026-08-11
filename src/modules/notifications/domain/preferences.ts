import type { NotificationEventType } from './notification-types';
import {
  MANDATORY_NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_TYPES,
  isNotificationEventType,
} from './notification-types';

export type NotificationPreferenceOverride = Readonly<{
  organizationId: string;
  userId: string;
  eventType: NotificationEventType;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}>;

export const DEFAULT_IN_APP_ENABLED = true;
export const DEFAULT_EMAIL_ENABLED = true;

export function isNotificationChannelToggleable(
  eventType: NotificationEventType,
): boolean {
  return !MANDATORY_NOTIFICATION_EVENTS.has(eventType);
}

export function assertValidEventType(eventType: string): asserts eventType is NotificationEventType {
  if (!isNotificationEventType(eventType)) {
    throw new Error(`Unsupported notification event type: ${eventType}`);
  }
}

export function listKnownEventTypes(): readonly NotificationEventType[] {
  return NOTIFICATION_EVENT_TYPES;
}
