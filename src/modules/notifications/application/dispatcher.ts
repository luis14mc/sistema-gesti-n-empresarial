import { Prisma, type NotificationChannel, type NotificationStatus, type PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/prisma';
import { createLogger } from '@/platform/observability/logger';
import { appendSecurityEvent } from '@/platform/security/audit/security-events';
import { recordSecurityEvent } from '@/platform/security/audit/security-events';
import { isChannelSupportedInPhase, isEmailChannel } from '../domain/channels';
import { isMandatoryNotificationEvent, type NotificationEventType } from '../domain/notification-types';
import { getNotificationRule, type NotificationRule } from '../domain/rules';
import { normalizeInternalPath } from './action-url';
import { buildIdempotencyKey } from './idempotency';
import { resolveRecipients } from './recipient-resolver';

export type DispatchInput = Readonly<{
  organizationId: string;
  eventType: NotificationEventType;
  aggregateId: string;
  eventId?: string | null;
  actorUserId?: string | null;
  requestId: string;
  title?: string;
  body?: string;
  actionUrl?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  recipientOverrides?: Readonly<{
    includeUserIds?: readonly string[];
    excludeUserIds?: ReadonlySet<string>;
  }>;
  phase?: '8A' | '8B' | '8C' | '8D' | '8F';
}>;

export type DispatchOutcome = Readonly<{
  eventType: NotificationEventType;
  aggregateId: string;
  channels: readonly NotificationChannel[];
  attemptedRecipients: number;
  created: ReadonlyArray<{ id: string; channel: NotificationChannel; userId: string; status: NotificationStatus }>;
  skipped: ReadonlyArray<{ channel: NotificationChannel; userId: string | null; reason: string }>;
  deduped: number;
}>;

const NOTIFICATION_AUDIT_MODULE = 'notifications';

export const notificationDispatcher = {
  async dispatch(input: DispatchInput, client: PrismaClient | Prisma.TransactionClient = defaultPrisma): Promise<DispatchOutcome> {
    const log = createLogger({
      requestId: input.requestId,
      organizationId: input.organizationId,
      module: NOTIFICATION_AUDIT_MODULE,
    });
    const rule = getNotificationRule(input.eventType);
    const phase = input.phase ?? '8A';
    const enabledChannels = rule.channels.filter((channel) => isChannelSupportedInPhase(channel, phase));
    const supportedChannels = enabledChannels.length > 0 ? enabledChannels : rule.channels.filter((channel) => channel === 'IN_APP');

    if (supportedChannels.length === 0) {
      log.warn('notification.dispatch.skipped.no_channels', { eventType: input.eventType });
      return {
        eventType: input.eventType,
        aggregateId: input.aggregateId,
        channels: [],
        attemptedRecipients: 0,
        created: [],
        skipped: [],
        deduped: 0,
      };
    }

    const recipients = await resolveRecipients(input.organizationId, rule.recipients, {
      excludeUserIds: input.recipientOverrides?.excludeUserIds,
      tx: client,
    });
    const filtered = applyRecipientOverrides(recipients, input.recipientOverrides);

    if (filtered.length === 0) {
      log.info('notification.dispatch.no_recipients', { eventType: input.eventType, aggregateId: input.aggregateId });
      await recordSecurityEvent({
        organizationId: input.organizationId,
        userId: input.actorUserId ?? undefined,
        eventType: `notification.dispatch.${input.eventType}`,
        outcome: 'SUCCESS',
        severity: 'INFO',
        reasonCode: 'NO_RECIPIENTS',
        module: NOTIFICATION_AUDIT_MODULE,
        entityType: 'Notification',
        entityId: input.aggregateId,
        action: 'DISPATCH',
        requestId: input.requestId,
        attributes: {
          channels: supportedChannels,
          aggregateId: input.aggregateId,
        },
      });
      return {
        eventType: input.eventType,
        aggregateId: input.aggregateId,
        channels: supportedChannels,
        attemptedRecipients: 0,
        created: [],
        skipped: [],
        deduped: 0,
      };
    }

    const created: Array<{ id: string; channel: NotificationChannel; userId: string; status: NotificationStatus }> = [];
    const skipped: Array<{ channel: NotificationChannel; userId: string | null; reason: string }> = [];
    let deduped = 0;
    const title = input.title ?? rule.defaultTitle;
    const body = input.body ?? rule.defaultBody;
    const actionPath = input.actionUrl === undefined
      ? (rule.defaultActionPath ?? null)
      : input.actionUrl;
    const normalizedActionPath = actionPath === null ? null : normalizeInternalPath(actionPath);

    for (const recipient of filtered) {
      for (const channel of supportedChannels) {
        const idempotencyKey = buildIdempotencyKey({
          organizationId: input.organizationId,
          eventType: input.eventType,
          aggregateId: input.aggregateId,
          recipientId: recipient.userId,
          channel,
          eventId: input.eventId ?? null,
        });
        try {
          const notification = await (client as PrismaClient).notification.create({
            data: {
              organizationId: input.organizationId,
              userId: recipient.userId,
              eventType: input.eventType,
              channel,
              status: channelInitialStatus(channel, input.eventType),
              title,
              body,
              actionUrl: normalizedActionPath,
              metadata: input.metadata ?? undefined,
              idempotencyKey,
              deliveries: {
                create: {
                  channel,
                  destination: channelDestination(channel, recipient),
                  status: channelInitialDeliveryStatus(channel, input.eventType),
                  provider: null,
                  attempt: 1,
                  startedAt: new Date(),
                  completedAt: channel === 'IN_APP' ? new Date() : null,
                },
              },
            },
            select: { id: true, channel: true, userId: true, status: true },
          });
          created.push({
            id: notification.id,
            channel: notification.channel,
            userId: notification.userId ?? recipient.userId,
            status: notification.status,
          });
          await appendSecurityEventIfTransactional(client as Prisma.TransactionClient, {
            organizationId: input.organizationId,
            eventType: `notification.created.${channel.toLowerCase()}`,
            action: 'DISPATCH',
            entityId: notification.id,
            requestId: input.requestId,
            userId: input.actorUserId ?? recipient.userId,
            attributes: {
              recipientId: recipient.userId,
              eventType: input.eventType,
              aggregateId: input.aggregateId,
              channel,
              mandatory: isMandatoryNotificationEvent(input.eventType),
            },
          });
        } catch (error) {
          if (isPrismaUniqueViolation(error, ['organizationId', 'idempotencyKey'])) {
            deduped += 1;
            skipped.push({ channel, userId: recipient.userId, reason: 'DEDUPED' });
            continue;
          }
          log.error('notification.dispatch.create_failed', { eventType: input.eventType, error, userId: recipient.userId, channel });
          throw error;
        }
      }
    }

    await recordSecurityEvent({
      organizationId: input.organizationId,
      userId: input.actorUserId ?? undefined,
      eventType: `notification.dispatch.${input.eventType}`,
      outcome: 'SUCCESS',
      severity: 'NOTICE',
      module: NOTIFICATION_AUDIT_MODULE,
      entityType: 'Notification',
      entityId: input.aggregateId,
      action: 'DISPATCH',
      requestId: input.requestId,
      attributes: {
        rule: input.eventType,
        channels: supportedChannels,
        attemptedRecipients: filtered.length,
        created: created.length,
        deduped,
        mandatory: isMandatoryNotificationEvent(input.eventType),
      },
    });

    log.info('notification.dispatch.completed', {
      eventType: input.eventType,
      aggregateId: input.aggregateId,
      created: created.length,
      deduped,
    });

    return {
      eventType: input.eventType,
      aggregateId: input.aggregateId,
      channels: supportedChannels,
      attemptedRecipients: filtered.length,
      created,
      skipped,
      deduped,
    };
  },
};

function applyRecipientOverrides(
  recipients: ReadonlyArray<{ userId: string; email: string; isActive: boolean }>,
  overrides?: DispatchInput['recipientOverrides'],
): ReadonlyArray<{ userId: string; email: string; isActive: boolean }> {
  if (!overrides) return recipients;
  if (!overrides.includeUserIds || overrides.includeUserIds.length === 0) return recipients;
  const include = new Set(overrides.includeUserIds);
  return recipients.filter((recipient) => include.has(recipient.userId));
}

function channelDestination(channel: NotificationChannel, recipient: { userId: string; email: string }): string {
  if (isEmailChannel(channel)) return recipient.email;
  return `in-app:${recipient.userId}`;
}

function channelInitialStatus(channel: NotificationChannel, _eventType: NotificationEventType): NotificationStatus {
  if (channel === 'IN_APP') return 'SENT';
  return 'PENDING';
}

function channelInitialDeliveryStatus(channel: NotificationChannel, _eventType: NotificationEventType): string {
  if (channel === 'IN_APP') return 'SENT';
  return 'PENDING';
}

async function appendSecurityEventIfTransactional(
  client: Prisma.TransactionClient | PrismaClient,
  input: {
    organizationId: string;
    eventType: string;
    action: string;
    entityId: string;
    requestId: string;
    userId?: string | null;
    attributes: Record<string, unknown>;
  },
) {
  if (isTransactionClient(client)) {
    await appendSecurityEvent(client, {
      organizationId: input.organizationId,
      eventType: input.eventType,
      outcome: 'SUCCESS',
      severity: 'INFO',
      module: NOTIFICATION_AUDIT_MODULE,
      entityType: 'Notification',
      entityId: input.entityId,
      action: input.action,
      requestId: input.requestId,
      userId: input.userId ?? undefined,
      attributes: input.attributes,
    });
  }
}

function isTransactionClient(client: Prisma.TransactionClient | PrismaClient): client is Prisma.TransactionClient {
  return typeof (client as { $transaction?: unknown }).$transaction === 'function';
}

function isPrismaUniqueViolation(error: unknown, target: readonly string[]): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;
  const fields = Array.isArray(error.meta?.target) ? error.meta?.target as string[] : [];
  return target.every((field) => fields.includes(field));
}

export type NotificationDispatcherService = typeof notificationDispatcher;
export type { NotificationRule };
