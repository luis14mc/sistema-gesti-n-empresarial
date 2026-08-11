import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { OrganizationContext } from '@/modules/organizations/application/context';
import { requirePermission } from '@/platform/security/authorization/permissions';

export type AuditLogQuery = Readonly<{
  userId?: string;
  module?: string;
  action?: string;
  page: number;
  pageSize: number;
}>;

export class AuditLogQueryService {
  async list(context: OrganizationContext, query: AuditLogQuery) {
    requirePermission(context, 'audit.read');

    const page = Number.isSafeInteger(query.page) && query.page > 0 ? query.page : 1;
    const pageSize = Number.isSafeInteger(query.pageSize)
      ? Math.min(Math.max(query.pageSize, 1), 100)
      : 20;
    const where: Prisma.AuditRecordWhereInput = {
      organizationId: context.organizationId,
      userId: query.userId || undefined,
      module: query.module || undefined,
      category: query.action || undefined,
    };

    const [logs, total] = await Promise.all([
      prisma.auditRecord.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          module: true,
          category: true,
          priority: true,
          status: true,
          entityId: true,
          entityType: true,
          action: true,
          requestId: true,
          createdAt: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditRecord.count({ where }),
    ]);

    return { logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}

export const auditLogQueryService = new AuditLogQueryService();
