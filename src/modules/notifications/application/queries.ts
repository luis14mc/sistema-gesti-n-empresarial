import type { Notification, NotificationStatus, Prisma } from '@prisma/client';
import {
  countNotifications,
  findNotification,
  listNotificationsPage,
  markNotificationRead,
  markNotificationsRead,
  type NotificationDbClient,
} from '../infrastructure/notification-repository';
import {
  NotificationNotFoundError,
  NotificationOwnershipError,
} from '../domain/errors';
import { recordSecurityEvent } from '@/platform/security/audit/security-events';

export type ListNotificationsInput = Readonly<{
  organizationId: string;
  userId: string;
  page: number;
  pageSize: number;
  unreadOnly?: boolean;
}>;

export type ListNotificationsResult = Readonly<{
  items: ReadonlyArray<Notification>;
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}>;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const notificationQueryService = {
  async list(
    input: ListNotificationsInput,
    client?: NotificationDbClient,
  ): Promise<ListNotificationsResult> {
    const page = Number.isSafeInteger(input.page) && input.page > 0 ? input.page : DEFAULT_PAGE;
    const pageSize = Math.min(
      Math.max(Number.isSafeInteger(input.pageSize) ? input.pageSize : DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );

    const baseWhere: Prisma.NotificationWhereInput = {
      organizationId: input.organizationId,
      OR: [{ userId: input.userId }, { userId: null }],
      ...(input.unreadOnly ? { readAt: null } : {}),
    };

    const [items, total, unreadCount] = await listNotificationsPage(client, {
      where: baseWhere,
      unreadWhere: {
        organizationId: input.organizationId,
        OR: [{ userId: input.userId }, { userId: null }],
        readAt: null,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items,
      total,
      unreadCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  async unreadCount(
    organizationId: string,
    userId: string,
    client?: NotificationDbClient,
  ): Promise<number> {
    return countNotifications(client, {
      organizationId,
      OR: [{ userId }, { userId: null }],
      readAt: null,
    });
  },
};

export const notificationCommandService = {
  async markRead(
    input: { organizationId: string; userId: string; notificationId: string; requestId: string },
    client?: NotificationDbClient,
  ): Promise<Notification> {
    const notification = await findNotification(client, input.organizationId, input.notificationId);
    if (!notification) throw new NotificationNotFoundError(input.notificationId, input.organizationId);
    if (notification.userId && notification.userId !== input.userId) {
      throw new NotificationOwnershipError(input.notificationId, input.userId);
    }
    if (notification.readAt) {
      return notification;
    }
    const updated = await markNotificationRead(client, input.notificationId);
    await recordSecurityEvent({
      organizationId: input.organizationId,
      userId: input.userId,
      eventType: 'notification.read',
      outcome: 'SUCCESS',
      severity: 'INFO',
      module: 'notifications',
      entityType: 'Notification',
      entityId: input.notificationId,
      action: 'MARK_READ',
      requestId: input.requestId,
      attributes: { eventType: notification.eventType, channel: notification.channel },
    });
    return updated;
  },

  async markAllRead(
    input: { organizationId: string; userId: string; requestId: string },
    client?: NotificationDbClient,
  ): Promise<{ updated: number }> {
    const result = await markNotificationsRead(client, {
      organizationId: input.organizationId,
      OR: [{ userId: input.userId }, { userId: null }],
      readAt: null,
    });
    await recordSecurityEvent({
      organizationId: input.organizationId,
      userId: input.userId,
      eventType: 'notification.read_all',
      outcome: 'SUCCESS',
      severity: 'INFO',
      module: 'notifications',
      entityType: 'Notification',
      action: 'MARK_ALL_READ',
      requestId: input.requestId,
      attributes: { updated: result.count },
    });
    return { updated: result.count };
  },
};

export type NotificationStatusValue = NotificationStatus;
