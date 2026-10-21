import type { DisposalStatus } from '@prisma/client';
import type { OrganizationContext } from '@/modules/organizations/application/context';
import { assertDisposalTransition } from '../domain/rules';
import { EquipmentDisposalError } from './errors';
import type { DisposalEvaluationInput } from '../presentation/schemas/disposal';
import { findDisposal, listDisposals } from '../infrastructure/repository';
import { generateAndStoreDisposalPdf } from '../infrastructure/pdf';
import {
  commitApproval,
  createDraftRecord,
  restoreAndClose,
  transition,
  updateDraftRecord,
} from '../infrastructure/disposal-workflow-store';
import { removeStoredDocument } from '@/modules/purchases/infrastructure/purchase-order-document-access';
import { requireOrganizationPermission } from '@/platform/security/authorization/effective-permissions';

export const equipmentDisposalService = {
  async list(context: OrganizationContext, input: { page: number; pageSize: number; status?: DisposalStatus; search?: string }) {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'equipment-disposal.read');
    return listDisposals({ organizationId: context.organizationId, ...input });
  },

  async get(context: OrganizationContext, id: string) {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'equipment-disposal.read');
    const disposal = await findDisposal(context.organizationId, id);
    if (!disposal) throw new EquipmentDisposalError('DISPOSAL_NOT_FOUND', 404);
    return disposal;
  },

  async createDraft(context: OrganizationContext, input: DisposalEvaluationInput, requestId: string) {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'equipment-disposal.create');
    return createDraftRecord(context, input, requestId);
  },

  async updateDraft(context: OrganizationContext, id: string, input: DisposalEvaluationInput & { version: number }, requestId: string) {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'equipment-disposal.update');
    return updateDraftRecord(context, id, input, requestId);
  },

  async submit(context: OrganizationContext, id: string, requestId: string) {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'equipment-disposal.submit');
    return transition(context, id, 'PENDING_APPROVAL', 'DISPOSAL_SUBMITTED', requestId);
  },

  async reject(context: OrganizationContext, id: string, reason: string, requestId: string) {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'equipment-disposal.reject');
    return restoreAndClose(context, id, 'REJECTED', 'DISPOSAL_REJECTED', reason, requestId);
  },

  async cancel(context: OrganizationContext, id: string, reason: string, requestId: string) {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'equipment-disposal.cancel');
    return restoreAndClose(context, id, 'CANCELLED', 'DISPOSAL_CANCELLED', reason, requestId);
  },

  async approve(context: OrganizationContext, id: string, requestId: string) {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'equipment-disposal.approve');
    const existing = await findDisposal(context.organizationId, id);
    if (!existing) throw new EquipmentDisposalError('DISPOSAL_NOT_FOUND', 404);
    if (existing.status === 'APPROVED') return existing;
    assertDisposalTransition(existing.status, 'APPROVED');
    if (existing.documents.length === 0) throw new EquipmentDisposalError('DISPOSAL_EVIDENCE_REQUIRED', 409);

    const stored = await generateAndStoreDisposalPdf(existing, requestId);
    try {
      await commitApproval(context, id, existing, stored, requestId);
    } catch (error) {
      await removeStoredDocument(stored.storageKey).catch(() => undefined);
      throw error;
    }
    return this.get(context, id);
  },
};
