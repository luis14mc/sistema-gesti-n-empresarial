import type { NotificationChannel, OrganizationRole } from '@prisma/client';
import type { NotificationEventType } from './notification-types';

export type RecipientKind =
  | 'organization-owners'
  | 'organization-admins'
  | 'organization-role'
  | 'specific-users';

export type NotificationRecipient = Readonly<{
  kind: RecipientKind;
  role?: OrganizationRole;
  userIds?: readonly string[];
}>;

export type NotificationRule = Readonly<{
  eventType: NotificationEventType;
  channels: readonly NotificationChannel[];
  mandatory: boolean;
  recipients: readonly NotificationRecipient[];
  description: string;
  defaultTitle: string;
  defaultBody: string;
  defaultActionPath?: string;
}>;

const ORG_OWNERS_AND_ADMINS: readonly NotificationRecipient[] = [
  { kind: 'organization-owners' },
  { kind: 'organization-admins' },
];

const ORG_OWNERS: readonly NotificationRecipient[] = [
  { kind: 'organization-owners' },
];

const ORG_ADMINS: readonly NotificationRecipient[] = [
  { kind: 'organization-admins' },
];

export const NOTIFICATION_RULES: Readonly<Record<NotificationEventType, NotificationRule>> = Object.freeze({
  'organization.lifecycle.created': {
    eventType: 'organization.lifecycle.created',
    channels: ['IN_APP'],
    mandatory: false,
    recipients: ORG_OWNERS,
    description: 'Notifica a los propietarios cuando se crea una nueva organización en la plataforma.',
    defaultTitle: 'Nueva organización creada',
    defaultBody: 'Se ha creado una nueva organización en la plataforma.',
    defaultActionPath: '/ajustes/organizacion',
  },
  'organization.lifecycle.activated': {
    eventType: 'organization.lifecycle.activated',
    channels: ['IN_APP'],
    mandatory: false,
    recipients: ORG_OWNERS_AND_ADMINS,
    description: 'Notifica a propietarios y administradores cuando una organización pasa a ACTIVE.',
    defaultTitle: 'Organización activada',
    defaultBody: 'La organización ha sido activada y está disponible para operaciones.',
    defaultActionPath: '/ajustes/organizacion',
  },
  'organization.lifecycle.suspended': {
    eventType: 'organization.lifecycle.suspended',
    channels: ['IN_APP', 'EMAIL'],
    mandatory: true,
    recipients: ORG_OWNERS_AND_ADMINS,
    description: 'Alerta obligatoria para propietarios y administradores cuando una organización es suspendida.',
    defaultTitle: 'Organización suspendida',
    defaultBody: 'La organización ha sido suspendida temporalmente. Las operaciones se bloquearán hasta su reactivación.',
    defaultActionPath: '/ajustes/organizacion',
  },
  'organization.lifecycle.reactivated': {
    eventType: 'organization.lifecycle.reactivated',
    channels: ['IN_APP', 'EMAIL'],
    mandatory: false,
    recipients: ORG_OWNERS_AND_ADMINS,
    description: 'Notifica a propietarios y administradores cuando una organización es reactivada.',
    defaultTitle: 'Organización reactivada',
    defaultBody: 'La organización ha sido reactivada y vuelve a estar disponible.',
    defaultActionPath: '/ajustes/organizacion',
  },
  'organization.lifecycle.archived': {
    eventType: 'organization.lifecycle.archived',
    channels: ['IN_APP', 'EMAIL'],
    mandatory: true,
    recipients: ORG_OWNERS_AND_ADMINS,
    description: 'Alerta obligatoria para propietarios y administradores cuando una organización es archivada.',
    defaultTitle: 'Organización archivada',
    defaultBody: 'La organización ha sido archivada. Los registros quedan en modo lectura.',
    defaultActionPath: '/ajustes/organizacion',
  },
  'organization.lifecycle.closure_requested': {
    eventType: 'organization.lifecycle.closure_requested',
    channels: ['IN_APP', 'EMAIL'],
    mandatory: true,
    recipients: ORG_ADMINS,
    description: 'Alerta obligatoria para administradores cuando se solicita el cierre de una organización.',
    defaultTitle: 'Cierre de organización solicitado',
    defaultBody: 'Se ha solicitado el cierre de la organización. Se generará un export final antes de archivar.',
    defaultActionPath: '/ajustes/organizacion',
  },
});

export function getNotificationRule(eventType: NotificationEventType): NotificationRule {
  return NOTIFICATION_RULES[eventType];
}

export function listNotificationRules(): readonly NotificationRule[] {
  return Object.values(NOTIFICATION_RULES);
}
