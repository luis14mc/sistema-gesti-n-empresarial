import { Prisma, type Notification, type NotificationStatus, type PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/prisma';
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
    client: PrismaClient | Prisma.TransactionClient = defaultPrisma,
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

    const [items, total, unreadCount] = await Promise.all([
      client.notification.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      client.notification.count({ where: baseWhere }),
      client.notification.count({
        where: {
          organizationId: input.organizationId,
          OR: [{ userId: input.userId }, { userId: null }],
          readAt: null,
        },
      }),
    ]);

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
    client: PrismaClient | Prisma.TransactionClient = defaultPrisma,
  ): Promise<number> {
    return client.notification.count({
      where: {
        organizationId,
        OR: [{ userId }, { userId: null }],
        readAt: null,
      },
    });
  },
};

export const notificationCommandService = {
  async markRead(
    input: { organizationId: string; userId: string; notificationId: string; requestId: string },
    client: PrismaClient | Prisma.TransactionClient = defaultPrisma,
  ): Promise<Notification> {
    const notification = await client.notification.findFirst({
      where: { id: input.notificationId, organizationId: input.organizationId },
    });
    if (!notification) throw new NotificationNotFoundError(input.notificationId, input.organizationId);
    if (notification.userId && notification.userId !== input.userId) {
      throw new NotificationOwnershipError(input.notificationId, input.userId);
    }
    if (notification.readAt) {
      return notification;
    }
    const updated = await client.notification.update({
      where: { id: input.notificationId },
      data: { readAt: new Date() },
    });
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
    client: PrismaClient | Prisma.TransactionClient = defaultPrisma,
  ): Promise<{ updated: number }> {
    const result = await client.notification.updateMany({
      where: {
        organizationId: input.organizationId,
        OR: [{ userId: input.userId }, { userId: null }],
        readAt: null,
      },
      data: { readAt: new Date() },
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
