import { createAuditRecord } from '@/platform/security/audit/audit-record';
import {
  correctiveActionWhere,
  createCorrectiveAction as insertCorrectiveAction,
  deleteCorrectiveAction,
  findAudit,
  findCorrectiveAction,
  findCorrectiveActionDetail,
  findCorrectiveActionSummary,
  findFindingInScope,
  listCorrectiveActions,
  updateCorrectiveActionAndReload,
} from '@/modules/audits/infrastructure/repository';

type Actor = { organizationId: string; userId: string; role: string };

export function listCorrectiveActionsPage(
  actor: Actor,
  filters: { status: string | null; auditId: string | null; findingId: string | null; responsibleId: string | null },
  skip: number,
  take: number,
) {
  const where = correctiveActionWhere(actor.organizationId);
  if (filters.status) where.status = filters.status as any;
  if (filters.auditId) where.auditId = filters.auditId;
  if (filters.findingId) where.findingId = filters.findingId;
  if (filters.responsibleId) where.responsibleId = filters.responsibleId;

  // IDOR: USER solo ve acciones donde es responsable
  if (actor.role === 'USER') {
    where.responsibleId = actor.userId;
  }

  return listCorrectiveActions(where, skip, take);
}

export async function createCorrectiveAction(actor: Actor, data: Record<string, any>) {
  const { description, auditId, findingId, responsibleId, dueDate, evidence, notes } = data;

  if (auditId) {
    const audit = await findAudit(actor.organizationId, auditId);
    if (!audit) return { kind: 'audit-not-found' as const };
  }
  if (findingId) {
    const finding = await findFindingInScope(actor.organizationId, auditId ?? undefined, findingId);
    if (!finding || (auditId && finding.auditId !== auditId)) {
      return { kind: 'finding-not-found' as const };
    }
  }

  const action = await insertCorrectiveAction({
    organizationId: actor.organizationId,
    description,
    auditId:        auditId ?? null,
    findingId:      findingId ?? null,
    responsibleId:  responsibleId ?? null,
    dueDate:        dueDate ? new Date(dueDate) : null,
    evidence:       evidence ?? null,
    notes:          notes ?? null,
  } as any);

  await createAuditRecord({
    title: 'Creación de acción correctiva',
    description: `Se creó acción: ${action.description.slice(0, 80)}`,
    module: 'AUDITORIA',
    category: 'CREATE',
    userId: actor.userId,
    entityId: action.id,
    organizationId: actor.organizationId,
    newData: { auditId: action.auditId, status: action.status },
  });

  return { kind: 'ok' as const, action };
}

export async function getCorrectiveAction(actor: Actor, id: string) {
  const action = await findCorrectiveActionDetail(actor.organizationId, id);
  if (!action) return { kind: 'not-found' as const };
  if (actor.role === 'USER' && action.responsibleId !== actor.userId) return { kind: 'forbidden' as const };
  return { kind: 'ok' as const, action };
}

export async function updateCorrectiveAction(actor: Actor, id: string, data: Record<string, any>) {
  const existing = await findCorrectiveAction(actor.organizationId, id);
  if (!existing) return { kind: 'not-found' as const };

  // USER solo puede actualizar evidencia/notas en sus propias acciones
  if (actor.role === 'USER' && existing.responsibleId !== actor.userId) {
    return { kind: 'forbidden' as const };
  }

  const action = await updateCorrectiveActionAndReload(actor.organizationId, id, {
    ...(data.description !== undefined && { description: data.description }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.responsibleId !== undefined && { responsibleId: data.responsibleId }),
    ...(data.dueDate !== undefined && {
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    }),
    ...(data.completedDate !== undefined && {
      completedDate: data.completedDate ? new Date(data.completedDate) : null,
    }),
    ...(data.evidence !== undefined && { evidence: data.evidence }),
    ...(data.notes !== undefined && { notes: data.notes }),
  } as any);

  await createAuditRecord({
    title: 'Actualización de acción correctiva',
    description: `Se actualizó acción: ${action.description.slice(0, 80)}`,
    module: 'AUDITORIA',
    category: 'UPDATE',
    userId: actor.userId,
    entityId: action.id,
    organizationId: actor.organizationId,
    previousData: { status: existing.status },
    newData: { status: action.status },
  });

  return { kind: 'ok' as const, action };
}

export async function removeCorrectiveAction(actor: Actor, id: string): Promise<boolean> {
  const existing = await findCorrectiveActionSummary(actor.organizationId, id);
  if (!existing) return false;

  await deleteCorrectiveAction(actor.organizationId, id);

  await createAuditRecord({
    title: 'Eliminación de acción correctiva',
    description: `Se eliminó acción: ${existing.description.slice(0, 80)}`,
    module: 'AUDITORIA',
    category: 'DELETE',
    userId: actor.userId,
    entityId: id,
    organizationId: actor.organizationId,
    previousData: { status: existing.status },
  });

  return true;
}
