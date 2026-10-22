import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auditChildScope, auditScope, correctiveActionScope } from './tenant-scope';

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

const personSelect = { id: true, firstName: true, lastName: true, email: true } as const;
const personSelectNoEmail = { id: true, firstName: true, lastName: true } as const;
const auditPeopleInclude = {
  leadAuditor: { select: personSelect },
  createdBy: { select: personSelect },
} as const;

export function listAudits(where: Prisma.AuditWhereInput, skip: number, take: number) {
  return Promise.all([
    prisma.audit.findMany({
      where,
      skip,
      take,
      include: auditPeopleInclude,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.audit.count({ where }),
  ]);
}

/** Genera el código correlativo AUD-NNN-AAAA y crea la auditoría en la misma transacción. */
export function createAuditWithNextCode(
  organizationId: string,
  buildData: (code: string) => Prisma.AuditUncheckedCreateInput,
) {
  return prisma.$transaction(async (tx) => {
    const year = new Date().getFullYear();
    const lastAudit = await tx.audit.findFirst({
      where: auditWhere(organizationId, { code: { startsWith: 'AUD-' } }),
      orderBy: { code: 'desc' },
    });

    let nextNumber = 1;
    if (lastAudit) {
      const parts = lastAudit.code.split('-');
      const lastNum = parseInt(parts[1]);
      if (!isNaN(lastNum)) nextNumber = lastNum + 1;
    }
    const code = `AUD-${nextNumber.toString().padStart(3, '0')}-${year}`;

    return tx.audit.create({
      data: buildData(code),
      include: auditPeopleInclude,
    });
  });
}

export function findAuditDetail(organizationId: string, id: string) {
  return prisma.audit.findFirst({
    where: auditWhere(organizationId, { id }),
    include: {
      ...auditPeopleInclude,
      findings: {
        orderBy: { createdAt: 'desc' },
      },
      checklist: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
}

export async function updateAuditAndReload(organizationId: string, id: string, data: Record<string, unknown>) {
  await prisma.audit.updateMany({
    where: auditWhere(organizationId, { id }),
    data,
  });
  return prisma.audit.findFirstOrThrow({
    where: auditWhere(organizationId, { id }),
    include: auditPeopleInclude,
  });
}

export function deleteAudit(organizationId: string, id: string) {
  return prisma.audit.deleteMany({ where: auditWhere(organizationId, { id }) });
}

export function createChecklistItem(data: Prisma.AuditChecklistItemUncheckedCreateInput) {
  return prisma.auditChecklistItem.create({ data });
}

export function findChecklistItem(organizationId: string, auditId: string, itemId: string) {
  return prisma.auditChecklistItem.findFirst({
    where: auditChildScope(organizationId, auditId, itemId),
  });
}

export async function updateChecklistItemAndReload(
  organizationId: string,
  auditId: string,
  itemId: string,
  data: Prisma.AuditChecklistItemUpdateManyMutationInput,
) {
  await prisma.auditChecklistItem.updateMany({
    where: auditChildScope(organizationId, auditId, itemId),
    data,
  });
  return prisma.auditChecklistItem.findFirstOrThrow({
    where: auditChildScope(organizationId, auditId, itemId),
  });
}

export function findLastFinding(auditId: string) {
  return prisma.auditFinding.findFirst({
    where: { auditId },
    orderBy: { code: 'desc' },
  });
}

export function createFinding(data: Prisma.AuditFindingUncheckedCreateInput) {
  return prisma.auditFinding.create({ data });
}

export function findFindingInScope(organizationId: string, auditId: string | undefined, findingId: string) {
  return prisma.auditFinding.findFirst({
    where: auditChildScope(organizationId, auditId, findingId),
  });
}

export function listCorrectiveActions(where: Prisma.CorrectiveActionWhereInput, skip: number, take: number) {
  return Promise.all([
    prisma.correctiveAction.findMany({
      where,
      skip,
      take,
      include: {
        responsible: { select: personSelect },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.correctiveAction.count({ where }),
  ]);
}

export function createCorrectiveAction(data: Prisma.CorrectiveActionUncheckedCreateInput) {
  return prisma.correctiveAction.create({
    data,
    include: {
      responsible: { select: personSelectNoEmail },
    },
  });
}

export function findCorrectiveActionDetail(organizationId: string, id: string) {
  return prisma.correctiveAction.findFirst({
    where: correctiveActionWhere(organizationId, { id }),
    include: {
      responsible: { select: personSelect },
    },
  });
}

export async function updateCorrectiveActionAndReload(
  organizationId: string,
  id: string,
  data: Prisma.CorrectiveActionUpdateManyMutationInput,
) {
  await prisma.correctiveAction.updateMany({
    where: correctiveActionWhere(organizationId, { id }),
    data,
  });
  return prisma.correctiveAction.findFirstOrThrow({
    where: correctiveActionWhere(organizationId, { id }),
    include: {
      responsible: { select: personSelectNoEmail },
    },
  });
}

export function findCorrectiveActionSummary(organizationId: string, id: string) {
  return prisma.correctiveAction.findFirst({
    where: correctiveActionWhere(organizationId, { id }),
    select: { description: true, status: true },
  });
}

export function deleteCorrectiveAction(organizationId: string, id: string) {
  return prisma.correctiveAction.deleteMany({ where: correctiveActionWhere(organizationId, { id }) });
}
