import type { NotificationChannel } from '@prisma/client';
import { isMandatoryNotificationEvent, type NotificationEventType } from './notification-types';

export type ChannelResolution = Readonly<{
  channel: NotificationChannel;
  supported: boolean;
  reason?: string;
}>;

export function isChannelSupportedInPhase(channel: NotificationChannel, phase: '8A' | '8B' | '8C' | '8D' | '8F' = '8A'): boolean {
  if (channel === 'IN_APP') return true;
  if (channel === 'EMAIL') return phase !== '8A' && phase !== '8B' && phase !== '8C';
  return false;
}

export function isEmailChannel(channel: NotificationChannel): boolean {
  return channel === 'EMAIL';
}

export function isInAppChannel(channel: NotificationChannel): boolean {
  return channel === 'IN_APP';
}

export function isMandatoryEvent(eventType: NotificationEventType): boolean {
  return isMandatoryNotificationEvent(eventType);
}
