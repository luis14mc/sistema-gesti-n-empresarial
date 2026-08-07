import { Prisma, type DisposalHistoryAction, type DisposalStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { OrganizationContext } from '@/modules/organizations/application/context';
import { evaluateEquipmentDisposal } from '../domain/evaluator';
import { assertDisposalTransition } from '../domain/rules';
import type { DisposalPolicy } from '../domain/types';
import { EquipmentDisposalError } from './errors';
import type { DisposalEvaluationInput } from '../presentation/schemas/disposal';
import { findDisposal, listDisposals } from '../infrastructure/repository';
import { generateAndStoreDisposalPdf } from '../infrastructure/pdf';
import { removeStoredDocument } from '@/lib/compras/orden/document-access';
import { allocateDocumentSequence } from '@/platform/sequences/document-sequence';
import { requirePermission } from '@/platform/security/authorization/permissions';
import { appendSecurityEvent } from '@/platform/security/audit/security-events';

function mapPolicy(policy: {
  maxAgeYears: Prisma.Decimal;
  repairThresholdPct: Prisma.Decimal;
  ageWeight: number;
  repairWeight: number;
  conditionWeight: number;
  securityWeight: number;
  approvalScoreThreshold: number;
  reviewScoreThreshold: number;
}): DisposalPolicy {
  return {
    maxAgeYears: policy.maxAgeYears.toNumber(),
    repairThresholdPct: policy.repairThresholdPct.toNumber(),
    weights: {
      AGE: policy.ageWeight,
      REPAIR_COST: policy.repairWeight,
      CONDITION: policy.conditionWeight,
      SECURITY: policy.securityWeight,
    },
    approvalScoreThreshold: policy.approvalScoreThreshold,
    reviewScoreThreshold: policy.reviewScoreThreshold,
  };
}

function auditData(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function recordHistory(
  tx: Prisma.TransactionClient,
  input: {
    context: OrganizationContext;
    disposalId: string;
    action: DisposalHistoryAction;
    requestId: string;
    previousValues?: unknown;
    newValues?: unknown;
  },
) {
  await tx.equipmentDisposalHistory.create({
    data: {
      organizationId: input.context.organizationId,
      disposalId: input.disposalId,
      action: input.action,
      performedById: input.context.userId,
      requestId: input.requestId,
      previousValues: input.previousValues === undefined ? undefined : auditData(input.previousValues),
      newValues: input.newValues === undefined ? undefined : auditData(input.newValues),
    },
  });
  await tx.auditRecord.create({
    data: {
      organizationId: input.context.organizationId,
      userId: input.context.userId,
      module: 'EQUIPMENT_DISPOSAL',
      entityType: 'EquipmentDisposal',
      entityId: input.disposalId,
      action: input.action,
      category: input.action,
      title: input.action,
      description: `Evento ${input.action} del dictamen técnico.`,
      priority: 'MEDIA',
      status: 'COMPLETADO',
      requestId: input.requestId,
      previousData: input.previousValues === undefined ? undefined : auditData(input.previousValues),
      newData: input.newValues === undefined ? undefined : auditData(input.newValues),
    },
  });
  await appendSecurityEvent(tx, {
    organizationId: input.context.organizationId,
    userId: input.context.userId,
    eventType: `equipment_disposal.${input.action.toLowerCase()}`,
    outcome: 'SUCCESS',
    severity: input.action === 'DISPOSAL_APPROVED' ? 'NOTICE' : 'INFO',
    module: 'equipment-disposal',
    entityType: 'EquipmentDisposal',
    entityId: input.disposalId,
    action: input.action,
    requestId: input.requestId,
    attributes: { historyAction: input.action },
  });
}

async function transition(
  context: OrganizationContext,
  id: string,
  status: DisposalStatus,
  action: DisposalHistoryAction,
  requestId: string,
) {
  return prisma.$transaction(async (tx) => {
    const disposal = await tx.equipmentDisposal.findFirst({ where: { id, organizationId: context.organizationId } });
    if (!disposal) throw new EquipmentDisposalError('DISPOSAL_NOT_FOUND', 404);
    assertDisposalTransition(disposal.status, status);
    const updated = await tx.equipmentDisposal.update({
      where: { id },
      data: { status, submittedAt: status === 'PENDING_APPROVAL' ? new Date() : undefined, version: { increment: 1 } },
    });
    await recordHistory(tx, { context, disposalId: id, action, requestId, previousValues: { status: disposal.status }, newValues: { status } });
    return updated;
  });
}

async function restoreAndClose(
  context: OrganizationContext,
  id: string,
  status: 'REJECTED' | 'CANCELLED',
  action: DisposalHistoryAction,
  reason: string,
  requestId: string,
) {
  return prisma.$transaction(async (tx) => {
    const disposal = await tx.equipmentDisposal.findFirst({ where: { id, organizationId: context.organizationId } });
    if (!disposal) throw new EquipmentDisposalError('DISPOSAL_NOT_FOUND', 404);
    assertDisposalTransition(disposal.status, status);

    // A-2 fix: validar que el equipo sigue en DISPOSAL_IN_PROGRESS antes de
    // restaurar. Si fue modificado fuera del flujo de disposal (p.ej. el flujo
    // de mantenimiento lo puso en IN_MAINTENANCE), abortamos y registramos
    // el drift en historial para investigación manual.
    const equipment = await tx.equipment.findUnique({
      where: { id: disposal.equipmentId },
      select: { id: true, status: true, organizationId: true },
    });
    if (!equipment || equipment.organizationId !== context.organizationId) {
      throw new EquipmentDisposalError('EQUIPMENT_NOT_FOUND', 404);
    }
    if (equipment.status !== 'DISPOSAL_IN_PROGRESS') {
      await recordHistory(tx, {
        context,
        disposalId: id,
        action: 'EQUIPMENT_STATUS_DRIFT_DETECTED',
        requestId,
        previousValues: { status: disposal.status },
        newValues: {
          attemptedRestoreTo: disposal.previousEquipmentStatus,
          actualEquipmentStatus: equipment.status,
          reason: 'equipment status changed outside disposal workflow',
        },
      });
      throw new EquipmentDisposalError('EQUIPMENT_STATE_DRIFT', 409);
    }

    const updated = await tx.equipmentDisposal.update({
      where: { id },
      data: {
        status, version: { increment: 1 },
        rejectedAt: status === 'REJECTED' ? new Date() : undefined,
        rejectionReason: status === 'REJECTED' ? reason : undefined,
        cancelledAt: status === 'CANCELLED' ? new Date() : undefined,
        cancellationReason: status === 'CANCELLED' ? reason : undefined,
      },
    });
    await tx.equipment.update({
      where: { id: disposal.equipmentId, organizationId: context.organizationId },
      data: { status: disposal.previousEquipmentStatus },
    });
    await recordHistory(tx, { context, disposalId: id, action, requestId, previousValues: { status: disposal.status }, newValues: { status, reason } });
    return updated;
  });
}

export const equipmentDisposalService = {
  list(context: OrganizationContext, input: { page: number; pageSize: number; status?: DisposalStatus; search?: string }) {
    requirePermission(context, 'equipment-disposal.read');
    return listDisposals({ organizationId: context.organizationId, ...input });
  },

  async get(context: OrganizationContext, id: string) {
    requirePermission(context, 'equipment-disposal.read');
    const disposal = await findDisposal(context.organizationId, id);
    if (!disposal) throw new EquipmentDisposalError('DISPOSAL_NOT_FOUND', 404);
    return disposal;
  },

  async createDraft(context: OrganizationContext, input: DisposalEvaluationInput, requestId: string) {
    requirePermission(context, 'equipment-disposal.create');
    return prisma.$transaction(async (tx) => {
      const [equipment, policy] = await Promise.all([
        tx.equipment.findFirst({
          where: { id: input.equipmentId, organizationId: context.organizationId },
          include: {
            assignments: {
              where: { status: 'ACTIVE' },
              take: 1,
              include: { employee: { select: { fullName: true } } },
            },
          },
        }),
        tx.disposalPolicy.findUnique({ where: { organizationId: context.organizationId } }),
      ]);
      if (!equipment) throw new EquipmentDisposalError('EQUIPMENT_NOT_FOUND', 404);
      if (!policy) throw new EquipmentDisposalError('ACTIVE_DISPOSAL_POLICY_NOT_FOUND', 409);
      if (equipment.assignments.length > 0) throw new EquipmentDisposalError('EQUIPMENT_HAS_ACTIVE_ASSIGNMENT', 409);
      if (['DISPOSAL_IN_PROGRESS', 'DISPOSED', 'RETIRED', 'LOST'].includes(equipment.status)) {
        throw new EquipmentDisposalError('EQUIPMENT_NOT_ELIGIBLE', 409);
      }
      const existing = await tx.equipmentDisposal.findFirst({
        where: { organizationId: context.organizationId, equipmentId: equipment.id, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
        select: { id: true },
      });
      if (existing) throw new EquipmentDisposalError('ACTIVE_EQUIPMENT_DISPOSAL_EXISTS', 409);

      const evaluation = evaluateEquipmentDisposal({
        physicalCondition: input.physicalCondition,
        functionalCondition: input.functionalCondition,
        securitySupportStatus: input.securitySupportStatus,
        purchaseDate: input.purchaseDate,
        evaluatedAt: new Date(),
        estimatedReplacementPrice: input.estimatedReplacementPrice,
        estimatedRepairCost: input.estimatedRepairCost,
      }, mapPolicy(policy));
      const year = new Date().getFullYear();
      const sequence = await allocateDocumentSequence(tx, {
        organizationId: context.organizationId,
        documentType: 'EQUIPMENT_DISPOSAL',
        year,
      });
      const folio = `${policy.folioPrefix}-${year}-${String(sequence).padStart(5, '0')}`;
      const disposal = await tx.equipmentDisposal.create({
        data: {
          organizationId: context.organizationId,
          folio,
          equipmentId: equipment.id,
          previousEquipmentStatus: equipment.status,
          serialNumber: equipment.serialNumber ?? 'SIN-SERIE',
          category: equipment.category,
          brand: equipment.brand,
          model: equipment.model,
          department: equipment.location ?? 'Sin departamento',
          custodianName: null,
          purchaseDate: input.purchaseDate,
          purchasePrice: new Prisma.Decimal(input.purchasePrice),
          estimatedRepairCost: new Prisma.Decimal(input.estimatedRepairCost),
          estimatedReplacementPrice: new Prisma.Decimal(input.estimatedReplacementPrice),
          physicalCondition: input.physicalCondition,
          functionalCondition: input.functionalCondition,
          securitySupportStatus: input.securitySupportStatus,
          technicalNotes: input.technicalNotes,
          evaluationScore: Math.round(evaluation.score),
          disposalResult: evaluation.result,
          evaluationRationales: auditData(evaluation),
          evaluatedById: context.userId,
        },
      });
      await tx.equipment.update({ where: { id: equipment.id }, data: { status: 'DISPOSAL_IN_PROGRESS' } });
      await recordHistory(tx, { context, disposalId: disposal.id, action: 'DISPOSAL_CREATED', requestId, newValues: disposal });
      await recordHistory(tx, { context, disposalId: disposal.id, action: 'EQUIPMENT_STATUS_CHANGED', requestId, previousValues: { status: equipment.status }, newValues: { status: 'DISPOSAL_IN_PROGRESS' } });
      return disposal;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  async updateDraft(context: OrganizationContext, id: string, input: DisposalEvaluationInput & { version: number }, requestId: string) {
    requirePermission(context, 'equipment-disposal.update');
    return prisma.$transaction(async (tx) => {
      const [disposal, policy] = await Promise.all([
        tx.equipmentDisposal.findFirst({ where: { id, organizationId: context.organizationId } }),
        tx.disposalPolicy.findUnique({ where: { organizationId: context.organizationId } }),
      ]);
      if (!disposal) throw new EquipmentDisposalError('DISPOSAL_NOT_FOUND', 404);
      if (disposal.status !== 'DRAFT') throw new EquipmentDisposalError('DISPOSAL_NOT_EDITABLE', 409);
      if (disposal.equipmentId !== input.equipmentId) throw new EquipmentDisposalError('EQUIPMENT_CHANGE_NOT_ALLOWED', 400);
      if (!policy) throw new EquipmentDisposalError('ACTIVE_DISPOSAL_POLICY_NOT_FOUND', 409);
      const evaluation = evaluateEquipmentDisposal({
        physicalCondition: input.physicalCondition,
        functionalCondition: input.functionalCondition,
        securitySupportStatus: input.securitySupportStatus,
        purchaseDate: input.purchaseDate,
        evaluatedAt: new Date(),
        estimatedReplacementPrice: input.estimatedReplacementPrice,
        estimatedRepairCost: input.estimatedRepairCost,
      }, mapPolicy(policy));
      const claimed = await tx.equipmentDisposal.updateMany({
        where: { id, organizationId: context.organizationId, status: 'DRAFT', version: input.version },
        data: {
          purchaseDate: input.purchaseDate,
          purchasePrice: new Prisma.Decimal(input.purchasePrice),
          estimatedRepairCost: new Prisma.Decimal(input.estimatedRepairCost),
          estimatedReplacementPrice: new Prisma.Decimal(input.estimatedReplacementPrice),
          physicalCondition: input.physicalCondition,
          functionalCondition: input.functionalCondition,
          securitySupportStatus: input.securitySupportStatus,
          technicalNotes: input.technicalNotes,
          evaluationScore: Math.round(evaluation.score),
          disposalResult: evaluation.result,
          evaluationRationales: auditData(evaluation),
          version: { increment: 1 },
        },
      });
      if (claimed.count !== 1) throw new EquipmentDisposalError('STALE_DISPOSAL_VERSION', 409);
      const updated = await tx.equipmentDisposal.findUniqueOrThrow({ where: { id } });
      await recordHistory(tx, { context, disposalId: id, action: 'DISPOSAL_UPDATED', requestId, previousValues: disposal, newValues: updated });
      return updated;
    });
  },

  async submit(context: OrganizationContext, id: string, requestId: string) {
    requirePermission(context, 'equipment-disposal.submit');
    return transition(context, id, 'PENDING_APPROVAL', 'DISPOSAL_SUBMITTED', requestId);
  },

  async reject(context: OrganizationContext, id: string, reason: string, requestId: string) {
    requirePermission(context, 'equipment-disposal.reject');
    return restoreAndClose(context, id, 'REJECTED', 'DISPOSAL_REJECTED', reason, requestId);
  },

  async cancel(context: OrganizationContext, id: string, reason: string, requestId: string) {
    requirePermission(context, 'equipment-disposal.cancel');
    return restoreAndClose(context, id, 'CANCELLED', 'DISPOSAL_CANCELLED', reason, requestId);
  },

  async approve(context: OrganizationContext, id: string, requestId: string) {
    requirePermission(context, 'equipment-disposal.approve');
    const existing = await findDisposal(context.organizationId, id);
    if (!existing) throw new EquipmentDisposalError('DISPOSAL_NOT_FOUND', 404);
    if (existing.status === 'APPROVED') return existing;
    assertDisposalTransition(existing.status, 'APPROVED');
    if (existing.documents.length === 0) throw new EquipmentDisposalError('DISPOSAL_EVIDENCE_REQUIRED', 409);

    const stored = await generateAndStoreDisposalPdf(existing, requestId);
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.equipmentDisposal.updateMany({
          where: { id, organizationId: context.organizationId, status: 'PENDING_APPROVAL', version: existing.version },
          data: {
            status: 'APPROVED', approvedById: context.userId, approvedAt: new Date(),
            pdfStorageKey: stored.storageKey, templateSnapshot: auditData(stored.templateSnapshot),
            dataSnapshot: auditData(stored.dataSnapshot), version: { increment: 1 },
          },
        });
        if (claimed.count !== 1) throw new EquipmentDisposalError('STALE_DISPOSAL_VERSION', 409);
        await tx.equipment.update({ where: { id: existing.equipmentId }, data: { status: 'DISPOSED', retiredAt: new Date(), retirementReason: `Dictamen ${existing.folio}` } });
        await tx.replacementProjection.upsert({
          where: { disposalId: id },
          update: {},
          create: { organizationId: context.organizationId, disposalId: id, equipmentId: existing.equipmentId, estimatedAmount: existing.estimatedReplacementPrice },
        });
        await recordHistory(tx, { context, disposalId: id, action: 'DISPOSAL_PDF_GENERATED', requestId, newValues: { storageKey: stored.storageKey } });
        await recordHistory(tx, { context, disposalId: id, action: 'DISPOSAL_APPROVED', requestId, previousValues: { status: existing.status }, newValues: { status: 'APPROVED' } });
        await recordHistory(tx, { context, disposalId: id, action: 'EQUIPMENT_STATUS_CHANGED', requestId, previousValues: { status: existing.equipment.status }, newValues: { status: 'DISPOSED' } });
      });
    } catch (error) {
      await removeStoredDocument(stored.storageKey).catch(() => undefined);
      throw error;
    }
    return this.get(context, id);
  },
};
