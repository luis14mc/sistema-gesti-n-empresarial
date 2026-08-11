import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auditScope, correctiveActionScope } from './tenant-scope';

// Audit and CorrectiveAction organizationId are introduced by the tenant migration.
export function auditWhere(organizationId: string, where: Record<string, unknown> = {}) {
  return { ...where, ...auditScope(organizationId) } as Prisma.AuditWhereInput;
}

export function correctiveActionWhere(organizationId: string, where: Record<string, unknown> = {}) {
  return { ...where, ...correctiveActionScope(organizationId) } as Prisma.CorrectiveActionWhereInput;
}

export function findAudit(organizationId: string, id: string) {
  return prisma.audit.findFirst({ where: auditWhere(organizationId, { id }) });
}

export function findCorrectiveAction(organizationId: string, id: string) {
  return prisma.correctiveAction.findFirst({ where: correctiveActionWhere(organizationId, { id }) });
}
