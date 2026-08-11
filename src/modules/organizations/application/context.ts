import type { OrganizationRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { AuthenticatedRequest } from '@/lib/middleware';
import { recordSecurityEventBestEffort } from '@/platform/security/audit/security-events';

export type OrganizationContext = {
  authorizationScope: 'organization';
  userId: string;
  organizationId: string;
  organizationSlug: string;
  timezone: string;
  membershipId: string;
  role: OrganizationRole;
};

export class AuthenticationRequiredError extends Error {
  readonly code = 'AUTHENTICATION_REQUIRED';
  readonly status = 401;
}

export class OrganizationMembershipRequiredError extends Error {
  readonly code = 'ORGANIZATION_MEMBERSHIP_REQUIRED';
  readonly status = 403;
}

export class OrganizationSelectionRequiredError extends Error {
  readonly code = 'ORGANIZATION_SELECTION_REQUIRED';
  readonly status = 409;
}

export class TenantAccessDeniedError extends Error {
  readonly code = 'TENANT_ACCESS_DENIED';
  readonly status = 403;
}

export type OrganizationContextError =
  | AuthenticationRequiredError
  | OrganizationMembershipRequiredError
  | OrganizationSelectionRequiredError
  | TenantAccessDeniedError;

export function isOrganizationContextError(error: unknown): error is OrganizationContextError {
  return error instanceof AuthenticationRequiredError ||
    error instanceof OrganizationMembershipRequiredError ||
    error instanceof OrganizationSelectionRequiredError ||
    error instanceof TenantAccessDeniedError;
}

export async function requireOrganizationContext(
  request: AuthenticatedRequest,
  requestId = crypto.randomUUID(),
): Promise<OrganizationContext> {
  const sessionUser = request.user;
  if (!sessionUser?.userId) throw new AuthenticationRequiredError();

  const selectedOrganizationId = request.cookies.get('organizationId')?.value ?? null;
  const user = await prisma.user.findFirst({
    where: { id: sessionUser.userId, isActive: true },
    select: { id: true, email: true },
  });
  if (!user) {
    warnDenied({ requestId, userId: sessionUser.userId, sessionEmail: sessionUser.email, membershipCount: 0, activeMembershipCount: 0, selectedOrganizationId, reason: 'CANONICAL_USER_NOT_FOUND' });
    await auditDenied(requestId, sessionUser.userId, 'CANONICAL_USER_NOT_FOUND', false, 0, 0);
    throw new AuthenticationRequiredError();
  }

  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: user.id },
    include: { organization: { select: { id: true, slug: true, status: true, timezone: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const activeMemberships = memberships.filter(
    (membership) => membership.status === 'ACTIVE' && membership.organization.status === 'ACTIVE',
  );

  if (activeMemberships.length === 0) {
    warnDenied({ requestId, userId: user.id, sessionEmail: user.email, membershipCount: memberships.length, activeMembershipCount: 0, selectedOrganizationId, reason: 'NO_ACTIVE_MEMBERSHIP' });
    await auditDenied(requestId, user.id, 'NO_ACTIVE_MEMBERSHIP', Boolean(selectedOrganizationId), memberships.length, 0);
    throw new OrganizationMembershipRequiredError();
  }

  const selectedMembership = selectedOrganizationId
    ? activeMemberships.find((membership) => membership.organizationId === selectedOrganizationId)
    : undefined;
  if (selectedOrganizationId && !selectedMembership) {
    warnDenied({ requestId, userId: user.id, sessionEmail: user.email, membershipCount: memberships.length, activeMembershipCount: activeMemberships.length, selectedOrganizationId, reason: 'SELECTED_ORGANIZATION_NOT_ALLOWED' });
    await auditDenied(requestId, user.id, 'SELECTED_ORGANIZATION_NOT_ALLOWED', true, memberships.length, activeMemberships.length);
    throw new TenantAccessDeniedError();
  }

  const membership = selectedMembership ?? (activeMemberships.length === 1 ? activeMemberships[0] : null);
  if (!membership) {
    warnDenied({ requestId, userId: user.id, sessionEmail: user.email, membershipCount: memberships.length, activeMembershipCount: activeMemberships.length, selectedOrganizationId, reason: 'ORGANIZATION_SELECTION_REQUIRED' });
    await auditDenied(requestId, user.id, 'ORGANIZATION_SELECTION_REQUIRED', false, memberships.length, activeMemberships.length);
    throw new OrganizationSelectionRequiredError();
  }

  return {
    authorizationScope: 'organization',
    userId: user.id,
    organizationId: membership.organizationId,
    organizationSlug: membership.organization.slug,
    timezone: membership.organization.timezone,
    membershipId: membership.id,
    role: membership.role,
  };
}

async function auditDenied(
  requestId: string,
  userId: string,
  reasonCode: string,
  selectedOrganizationProvided: boolean,
  membershipCount: number,
  activeMembershipCount: number,
): Promise<void> {
  await recordSecurityEventBestEffort({
    userId,
    eventType: 'tenant.context.denied',
    outcome: 'DENIED',
    severity: 'WARNING',
    reasonCode,
    module: 'security',
    entityType: 'OrganizationContext',
    action: 'RESOLVE',
    requestId,
    attributes: { selectedOrganizationProvided, membershipCount, activeMembershipCount },
  });
}

function warnDenied(input: {
  requestId: string;
  userId: string;
  sessionEmail: string;
  membershipCount: number;
  activeMembershipCount: number;
  selectedOrganizationId: string | null;
  reason: string;
}) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[ORGANIZATION CONTEXT DENIED]', input);
  }
}
