import type { NotificationChannel, NotificationDeliveryStatus, NotificationStatus } from '@prisma/client';

export { NotificationChannel, NotificationStatus };

export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = ['IN_APP', 'EMAIL'] as const;

export type NotificationDeliveryStatusValue = NotificationDeliveryStatus | 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'SKIPPED';

export const NOTIFICATION_DELIVERY_STATUSES: readonly NotificationDeliveryStatusValue[] = [
  'PENDING',
  'PROCESSING',
  'SENT',
  'FAILED',
  'SKIPPED',
];

export type NotificationEventType =
  | 'organization.lifecycle.suspended'
  | 'organization.lifecycle.reactivated'
  | 'organization.lifecycle.archived'
  | 'organization.lifecycle.closure_requested'
  | 'organization.lifecycle.created'
  | 'organization.lifecycle.activated';

export const NOTIFICATION_EVENT_TYPES: readonly NotificationEventType[] = [
  'organization.lifecycle.suspended',
  'organization.lifecycle.reactivated',
  'organization.lifecycle.archived',
  'organization.lifecycle.closure_requested',
  'organization.lifecycle.created',
  'organization.lifecycle.activated',
];

export function isNotificationEventType(value: string): value is NotificationEventType {
  return (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(value);
}

export function isMandatoryNotificationEvent(eventType: NotificationEventType): boolean {
  return MANDATORY_NOTIFICATION_EVENTS.has(eventType);
}

export const MANDATORY_NOTIFICATION_EVENTS: ReadonlySet<NotificationEventType> = new Set<NotificationEventType>([
  'organization.lifecycle.suspended',
  'organization.lifecycle.closure_requested',
  'organization.lifecycle.archived',
]);

export const DEFAULT_TITLE_BY_EVENT: Readonly<Record<NotificationEventType, string>> = Object.freeze({
  'organization.lifecycle.created': 'Nueva organización creada',
  'organization.lifecycle.activated': 'Organización activada',
  'organization.lifecycle.suspended': 'Organización suspendida',
  'organization.lifecycle.reactivated': 'Organización reactivada',
  'organization.lifecycle.archived': 'Organización archivada',
  'organization.lifecycle.closure_requested': 'Cierre de organización solicitado',
});

export const DEFAULT_BODY_BY_EVENT: Readonly<Record<NotificationEventType, string>> = Object.freeze({
  'organization.lifecycle.created': 'Se ha creado una nueva organización en la plataforma.',
  'organization.lifecycle.activated': 'La organización ha sido activada y está disponible para operaciones.',
  'organization.lifecycle.suspended': 'La organización ha sido suspendida temporalmente. Las operaciones se bloquearán hasta su reactivación.',
  'organization.lifecycle.reactivated': 'La organización ha sido reactivada y vuelve a estar disponible.',
  'organization.lifecycle.archived': 'La organización ha sido archivada. Los registros quedan en modo lectura.',
  'organization.lifecycle.closure_requested': 'Se ha solicitado el cierre de la organización. Se generará un export final antes de archivar.',
});

export const DEFAULT_ACTION_PATH_BY_EVENT: Readonly<Record<NotificationEventType, string>> = Object.freeze({
  'organization.lifecycle.created': '/ajustes/organizacion',
  'organization.lifecycle.activated': '/ajustes/organizacion',
  'organization.lifecycle.suspended': '/ajustes/organizacion',
  'organization.lifecycle.reactivated': '/ajustes/organizacion',
  'organization.lifecycle.archived': '/ajustes/organizacion',
  'organization.lifecycle.closure_requested': '/ajustes/organizacion',
});
