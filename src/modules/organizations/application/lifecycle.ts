import type { OrganizationStatus, Prisma, SecurityEventOutcome, SecurityEventSeverity } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { appendSecurityEvent, recordSecurityEvent } from '@/platform/security/audit/security-events';
import { createLogger } from '@/platform/observability/logger';
import { notificationDispatcher } from '@/modules/notifications/application/dispatcher';
import type { NotificationEventType } from '@/modules/notifications/domain/notification-types';
import {
  OrganizationNotFoundError,
} from '../domain/errors';
import {
  assertOnboardingReadyForActivation,
  assertOrganizationTransition,
} from '../domain/rules';

export type OrganizationActor = Readonly<{
  userId: string;
  email?: string;
  requestId: string;
}>;

export type OrganizationPlatformActor = Readonly<{
  userId: string;
  email?: string;
  requestId: string;
  authorizationScope?: 'platform' | 'organization';
  role?: string;
}>;

export type CreateOrganizationInput = Readonly<{
  name: string;
  slug: string;
  legalName?: string | null;
  rtn?: string | null;
  timezone?: string;
  locale?: string;
  currency?: string;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  settings?: Prisma.InputJsonValue | null;
}>;

export type OrganizationLifecycleInput = Readonly<{
  organizationId: string;
  reason: string;
}>;

type LifecycleOutcome = 'SUCCESS' | 'DENIED' | 'FAILURE';

const ORGANIZATION_AUDIT_MODULE = 'organizations';

function auditEventType(action: string): string {
  return `organization.lifecycle.${action}`;
}

type LifecycleEventInput = Readonly<{
  organizationId: string;
  eventType: string;
  outcome: SecurityEventOutcome;
  severity: SecurityEventSeverity;
  module: string;
  entityType: string;
  entityId: string;
  action: string;
  requestId: string;
  userId: string;
  attributes: Record<string, unknown>;
}>;

function buildEvent(
  organizationId: string,
  action: string,
  outcome: LifecycleOutcome,
  attributes: Record<string, unknown>,
  actor: OrganizationPlatformActor,
): LifecycleEventInput {
  return {
    organizationId,
    eventType: auditEventType(action),
    outcome: outcome as SecurityEventOutcome,
    severity: outcome === 'DENIED' ? 'WARNING' : 'NOTICE',
    module: ORGANIZATION_AUDIT_MODULE,
    entityType: 'Organization',
    entityId: organizationId,
    action,
    requestId: actor.requestId,
    userId: actor.userId,
    attributes,
  };
}

async function audit(
  organizationId: string,
  action: string,
  outcome: LifecycleOutcome,
  attributes: Record<string, unknown>,
  actor: OrganizationPlatformActor,
) {
  const event = buildEvent(organizationId, action, outcome, attributes, actor);
  await recordSecurityEvent(event);
}

async function countActiveOwners(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<number> {
  return tx.organizationMembership.count({
    where: { organizationId, role: 'OWNER', status: 'ACTIVE' },
  });
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

function validateCreateInput(input: CreateOrganizationInput): CreateOrganizationInput {
  const name = input.name?.trim();
  if (!name || name.length < 2) {
    throw new InvalidOrganizationCommandError('El nombre de la organización es obligatorio.');
  }
  const slug = normalizeSlug(input.slug ?? name);
  if (!slug) {
    throw new InvalidOrganizationCommandError('El slug de la organización es obligatorio.');
  }
  return {
    ...input,
    name,
    slug,
    timezone: input.timezone?.trim() || 'America/Tegucigalpa',
    locale: input.locale?.trim() || 'es-HN',
    currency: input.currency?.trim() || 'HNL',
  };
}

export class InvalidOrganizationCommandError extends Error {
  readonly name = 'InvalidOrganizationCommandError';
  readonly code = 'INVALID_ORGANIZATION_COMMAND';
  readonly status = 422;
  constructor(message: string) {
    super(message);
  }
}

export const organizationLifecycleService = {
  async create(input: CreateOrganizationInput, actor: OrganizationPlatformActor) {
    const log = createLogger({ requestId: actor.requestId, module: 'organizations' });
    const data = validateCreateInput(input);
    try {
      const organization = await prisma.$transaction(async (tx) => {
        const created = await tx.organization.create({
          data: {
            name: data.name,
            slug: data.slug,
            legalName: data.legalName ?? null,
            rtn: data.rtn ?? null,
            timezone: data.timezone,
            locale: data.locale,
            currency: data.currency,
            primaryContactName: data.primaryContactName ?? null,
            primaryContactEmail: data.primaryContactEmail ?? null,
            primaryContactPhone: data.primaryContactPhone ?? null,
            settings: data.settings ?? undefined,
            status: 'PROVISIONING',
            onboardingStatus: 'PENDING',
          },
        });
        await appendSecurityEvent(tx, buildEvent(created.id, 'created', 'SUCCESS', {
          slug: created.slug,
          status: created.status,
        }, actor));
        return created;
      });
      log.info('organization.lifecycle.created', { organizationId: organization.id, slug: organization.slug });
      return organization;
    } catch (error) {
      log.error('organization.lifecycle.create_failed', { error });
      throw error;
    }
  },

  async activate(input: { organizationId: string }, actor: OrganizationPlatformActor) {
    const { organizationId } = input;
    const log = createLogger({ requestId: actor.requestId, organizationId, module: 'organizations' });
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        await audit(organizationId, 'activate', 'DENIED', { reason: 'NOT_FOUND' }, actor);
        throw new OrganizationNotFoundError(organizationId);
      }
      try {
        assertOrganizationTransition(organization.status as OrganizationStatus, 'ACTIVE');
        assertOnboardingReadyForActivation(organizationId, organization.onboardingStatus);
      } catch (error) {
        await audit(organizationId, 'activate', 'DENIED', {
          from: organization.status,
          onboardingStatus: organization.onboardingStatus,
          error: error instanceof Error ? error.name : 'UNKNOWN',
        }, actor);
        throw error;
      }
      const activeOwners = await countActiveOwners(tx, organizationId);
      if (activeOwners < 1) {
        await audit(organizationId, 'activate', 'DENIED', { reason: 'NO_ACTIVE_OWNER' }, actor);
        throw new InvalidOrganizationCommandError('La organización debe tener al menos un propietario activo antes de activarse.');
      }
      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: {
          status: 'ACTIVE',
          activatedAt: organization.activatedAt ?? new Date(),
          suspendedAt: null,
          archivedAt: null,
          deletionRequestedAt: null,
          onboardingStatus: organization.onboardingStatus === 'PENDING' ? 'IN_PROGRESS' : organization.onboardingStatus,
        },
      });
      await appendSecurityEvent(tx, buildEvent(organizationId, 'activated', 'SUCCESS', {
        from: organization.status,
        to: updated.status,
        activatedAt: updated.activatedAt,
      }, actor));
      log.info('organization.lifecycle.activated', { status: updated.status });
      return updated;
    });
  },

  async suspend(input: OrganizationLifecycleInput, actor: OrganizationPlatformActor) {
    const { organizationId, reason } = input;
    if (!reason?.trim()) {
      throw new InvalidOrganizationCommandError('Debe proporcionar un motivo para suspender la organización.');
    }
    const log = createLogger({ requestId: actor.requestId, organizationId, module: 'organizations' });
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        await audit(organizationId, 'suspend', 'DENIED', { reason: 'NOT_FOUND' }, actor);
        throw new OrganizationNotFoundError(organizationId);
      }
      try {
        assertOrganizationTransition(organization.status as OrganizationStatus, 'SUSPENDED');
      } catch (error) {
        await audit(organizationId, 'suspend', 'DENIED', { from: organization.status, reason }, actor);
        throw error;
      }
      const activeOwners = await countActiveOwners(tx, organizationId);
      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: {
          status: 'SUSPENDED',
          suspendedAt: new Date(),
        },
      });
      await appendSecurityEvent(tx, buildEvent(organizationId, 'suspended', 'SUCCESS', {
        from: organization.status,
        to: updated.status,
        reason,
        activeOwners,
      }, actor));
      log.info('organization.lifecycle.suspended', { reason });
      return updated;
    }).then(async (updated) => {
      await dispatchLifecycleNotification({
        organizationId,
        eventType: 'organization.lifecycle.suspended',
        actor,
        metadata: { reason, from: 'ACTIVE' },
      });
      return updated;
    });
  },

  async reactivate(input: OrganizationLifecycleInput, actor: OrganizationPlatformActor) {
    const { organizationId, reason } = input;
    const log = createLogger({ requestId: actor.requestId, organizationId, module: 'organizations' });
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        await audit(organizationId, 'reactivate', 'DENIED', { reason: 'NOT_FOUND' }, actor);
        throw new OrganizationNotFoundError(organizationId);
      }
      try {
        assertOrganizationTransition(organization.status as OrganizationStatus, 'ACTIVE');
      } catch (error) {
        await audit(organizationId, 'reactivate', 'DENIED', { from: organization.status, reason }, actor);
        throw error;
      }
      const activeOwners = await countActiveOwners(tx, organizationId);
      if (activeOwners < 1) {
        await audit(organizationId, 'reactivate', 'DENIED', { reason: 'NO_ACTIVE_OWNER' }, actor);
        throw new InvalidOrganizationCommandError('La organización debe tener al menos un propietario activo antes de reactivarse.');
      }
      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: {
          status: 'ACTIVE',
          suspendedAt: null,
        },
      });
      await appendSecurityEvent(tx, buildEvent(organizationId, 'reactivated', 'SUCCESS', {
        from: organization.status,
        to: updated.status,
        reason,
        activeOwners,
      }, actor));
      log.info('organization.lifecycle.reactivated', { reason });
      return updated;
    }).then(async (updated) => {
      await dispatchLifecycleNotification({
        organizationId,
        eventType: 'organization.lifecycle.reactivated',
        actor,
        metadata: { reason, from: 'SUSPENDED' },
      });
      return updated;
    });
  },

  async archive(input: OrganizationLifecycleInput, actor: OrganizationPlatformActor) {
    const { organizationId, reason } = input;
    if (!reason?.trim()) {
      throw new InvalidOrganizationCommandError('Debe proporcionar un motivo para archivar la organización.');
    }
    const log = createLogger({ requestId: actor.requestId, organizationId, module: 'organizations' });
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        await audit(organizationId, 'archive', 'DENIED', { reason: 'NOT_FOUND' }, actor);
        throw new OrganizationNotFoundError(organizationId);
      }
      const previousStatus = organization.status as OrganizationStatus;
      try {
        assertOrganizationTransition(previousStatus, 'ARCHIVED');
      } catch (error) {
        await audit(organizationId, 'archive', 'DENIED', { from: previousStatus, reason }, actor);
        throw error;
      }
      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: {
          status: 'ARCHIVED',
          archivedAt: new Date(),
          suspendedAt: previousStatus === 'SUSPENDED' ? organization.suspendedAt : null,
        },
      });
      await appendSecurityEvent(tx, buildEvent(organizationId, 'archived', 'SUCCESS', {
        from: previousStatus,
        to: updated.status,
        reason,
        requiresPlatformPermission: previousStatus === 'ARCHIVED',
      }, actor));
      log.info('organization.lifecycle.archived', { reason, previousStatus });
      return { updated, previousStatus };
    }).then(async ({ updated, previousStatus }) => {
      await dispatchLifecycleNotification({
        organizationId,
        eventType: 'organization.lifecycle.archived',
        actor,
        metadata: { reason, from: previousStatus },
      });
      return updated;
    });
  },

  async requestClosure(input: OrganizationLifecycleInput, actor: OrganizationPlatformActor) {
    const { organizationId, reason } = input;
    if (!reason?.trim()) {
      throw new InvalidOrganizationCommandError('Debe proporcionar un motivo para solicitar el cierre de la organización.');
    }
    const log = createLogger({ requestId: actor.requestId, organizationId, module: 'organizations' });
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        await audit(organizationId, 'request_closure', 'DENIED', { reason: 'NOT_FOUND' }, actor);
        throw new OrganizationNotFoundError(organizationId);
      }
      const previousStatus = organization.status as OrganizationStatus;
      try {
        assertOrganizationTransition(previousStatus, 'PENDING_DELETION');
      } catch (error) {
        await audit(organizationId, 'request_closure', 'DENIED', { from: previousStatus, reason }, actor);
        throw error;
      }
      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: {
          status: 'PENDING_DELETION',
          deletionRequestedAt: new Date(),
          archivedAt: previousStatus === 'ACTIVE' || previousStatus === 'SUSPENDED' ? null : organization.archivedAt,
        },
      });
      await appendSecurityEvent(tx, buildEvent(organizationId, 'closure_requested', 'SUCCESS', {
        from: previousStatus,
        to: updated.status,
        reason,
        deletionRequestedAt: updated.deletionRequestedAt,
      }, actor));
      log.info('organization.lifecycle.closure_requested', { reason, previousStatus });
      return { updated, previousStatus };
    }).then(async ({ updated, previousStatus }) => {
      await dispatchLifecycleNotification({
        organizationId,
        eventType: 'organization.lifecycle.closure_requested',
        actor,
        metadata: { reason, from: previousStatus },
      });
      return updated;
    });
  },
};

async function dispatchLifecycleNotification(input: {
  organizationId: string;
  eventType: NotificationEventType;
  actor: OrganizationPlatformActor;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await notificationDispatcher.dispatch({
      organizationId: input.organizationId,
      eventType: input.eventType,
      aggregateId: input.organizationId,
      eventId: input.actor.requestId,
      actorUserId: input.actor.userId,
      requestId: input.actor.requestId,
      metadata: input.metadata ?? null,
      phase: '8A',
    });
  } catch (error) {
    createLogger({
      requestId: input.actor.requestId,
      organizationId: input.organizationId,
      module: 'notifications',
    }).error('organization.lifecycle.notification_dispatch_failed', {
      eventType: input.eventType,
      error,
    });
  }
}

export type OrganizationLifecycleService = typeof organizationLifecycleService;
