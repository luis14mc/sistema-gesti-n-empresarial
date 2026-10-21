import type { Prisma } from '@prisma/client';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import {
  auditWhere,
  createAuditWithNextCode,
  createChecklistItem,
  createFinding,
  deleteAudit,
  findAudit,
  findAuditDetail,
  findChecklistItem,
  findLastFinding,
  listAudits,
  updateAuditAndReload,
  updateChecklistItemAndReload,
} from '@/modules/audits/infrastructure/repository';

type Actor = { organizationId: string; userId: string };

export function listAuditsPage(
  organizationId: string,
  filters: { status: string | null; type: string | null; search: string | null },
  skip: number,
  take: number,
) {
  const where: Prisma.AuditWhereInput = auditWhere(organizationId);

  if (filters.status) where.status = filters.status as Prisma.EnumAuditStatusFilter;
  if (filters.type) where.type = filters.type as Prisma.EnumAuditTypeFilter;

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
      { standard: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return listAudits(where, skip, take);
}

export async function createAudit(actor: Actor, input: Record<string, any>) {
  const { title, description, type, standard, scope, objectives, criteria, department, leadAuditorId, plannedDate } = input;

  const audit = await createAuditWithNextCode(actor.organizationId, (code) => ({
    organizationId: actor.organizationId,
    code,
    title,
    description,
    type: type || 'INTERNAL',
    standard,
    scope,
    objectives,
    criteria,
    department,
    leadAuditorId: leadAuditorId || null,
    plannedDate: plannedDate ? new Date(plannedDate) : null,
    createdById: actor.userId,
  } as Prisma.AuditUncheckedCreateInput));

  await createAuditRecord({
    title: 'Creación de auditoría',
    description: `Se creó auditoría: ${audit.title}`,
    module: 'MANUAL',
    category: 'CREATE',
    userId: actor.userId,
    entityId: audit.id,
    organizationId: actor.organizationId,
    newData: { code: audit.code, title, type },
  });

  return audit;
}

export function getAuditDetail(organizationId: string, id: string) {
  return findAuditDetail(organizationId, id);
}

const AUDIT_UPDATABLE_FIELDS = [
  'title', 'description', 'type', 'status', 'standard', 'scope',
  'objectives', 'criteria', 'department', 'conclusions',
  'recommendations', 'auditeeContact', 'leadAuditorId',
  'plannedDate', 'startDate', 'endDate'
];

export async function updateAudit(actor: Actor, id: string, data: Record<string, any>) {
  const current = await findAudit(actor.organizationId, id);
  if (!current) return null;

  const updateData: any = {};
  AUDIT_UPDATABLE_FIELDS.forEach((field) => {
    if (data[field] !== undefined) {
      if (['plannedDate'].includes(field) && data[field]) {
        updateData[field] = new Date(data[field]);
      } else if (['startDate', 'endDate'].includes(field) && data[field]) {
        updateData[field] = new Date(data[field]);
      } else {
        updateData[field] = data[field];
      }
    }
  });

  const audit = await updateAuditAndReload(actor.organizationId, id, updateData);

  await createAuditRecord({
    title: 'Actualización de auditoría',
    description: `Se actualizó auditoría: ${audit.title}`,
    module: 'MANUAL',
    category: 'UPDATE',
    userId: actor.userId,
    entityId: audit.id,
    organizationId: actor.organizationId,
    previousData: { status: current.status },
    newData: { status: audit.status },
  });

  return audit;
}

export async function removeAudit(actor: Actor, id: string): Promise<boolean> {
  const current = await findAudit(actor.organizationId, id);
  if (!current) return false;

  await deleteAudit(actor.organizationId, id);

  await createAuditRecord({
    title: 'Eliminación de auditoría',
    description: `Se eliminó auditoría: ${current.title}`,
    module: 'MANUAL',
    category: 'DELETE',
    userId: actor.userId,
    entityId: id,
    organizationId: actor.organizationId,
    previousData: { code: current.code, title: current.title },
  });

  return true;
}

export async function addChecklistItem(
  actor: Actor,
  auditId: string,
  input: { requirement: string; clause?: string; sortOrder?: number },
) {
  const audit = await findAudit(actor.organizationId, auditId);
  if (!audit) return null;

  const { requirement, clause, sortOrder } = input;
  const item = await createChecklistItem({
    auditId,
    requirement,
    clause,
    sortOrder: sortOrder ?? 0,
    completed: false,
  });

  await createAuditRecord({
    title: 'Item de checklist agregado',
    description: `Se agregó item al checklist de auditoría ${audit.code}`,
    module: 'MANUAL',
    category: 'CREATE',
    userId: actor.userId,
    entityId: item.id,
    organizationId: actor.organizationId,
    newData: { requirement, clause, auditId: audit.id },
  });

  return item;
}

export async function evaluateChecklistItem(
  actor: Actor,
  auditId: string,
  input: { itemId: string; result?: any; notes?: any; evidence?: any; completed?: any },
) {
  const { itemId, result, notes, evidence, completed } = input;
  const existing = await findChecklistItem(actor.organizationId, auditId, itemId);
  if (!existing) return null;

  const item = await updateChecklistItemAndReload(actor.organizationId, auditId, itemId, {
    result: result ?? existing.result,
    notes: notes !== undefined ? notes : existing.notes,
    evidence: evidence !== undefined ? evidence : existing.evidence,
    completed: completed !== undefined ? completed : existing.completed,
  });

  await createAuditRecord({
    title: 'Evaluación de checklist actualizada',
    description: `Se actualizó resultado del item ${itemId}`,
    module: 'MANUAL',
    category: 'UPDATE',
    userId: actor.userId,
    entityId: item.id,
    organizationId: actor.organizationId,
    previousData: { result: existing.result, completed: existing.completed },
    newData: { result: item.result, completed: item.completed },
  });

  return item;
}

export async function addFinding(
  actor: Actor,
  auditId: string,
  input: { description: string; severity: any; evidence?: string; clause?: string },
) {
  const audit = await findAudit(actor.organizationId, auditId);
  if (!audit) return null;

  const lastFinding = await findLastFinding(auditId);

  let nextNumber = 1;
  if (lastFinding?.code) {
    const parts = lastFinding.code.split('-');
    const lastNum = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastNum)) nextNumber = lastNum + 1;
  }
  const code = `${audit.code}-H${nextNumber.toString().padStart(2, '0')}`;

  const { description, severity, evidence, clause } = input;
  const finding = await createFinding({
    auditId,
    code,
    description,
    severity,
    evidence,
    clause,
    status: 'OPEN',
  });

  await createAuditRecord({
    title: 'Hallazgo registrado',
    description: `Se registró hallazgo en auditoría ${audit.code}`,
    module: 'MANUAL',
    category: 'CREATE',
    userId: actor.userId,
    entityId: finding.id,
    organizationId: actor.organizationId,
    newData: { code, severity, auditId: audit.id },
  });

  return finding;
}
