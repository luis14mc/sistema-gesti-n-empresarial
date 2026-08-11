import type { PlatformRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { AuthenticatedRequest } from '@/lib/middleware';
import { recordSecurityEventBestEffort } from '@/platform/security/audit/security-events';

export type PlatformContext = Readonly<{
  authorizationScope: 'platform';
  userId: string;
  email: string;
  role: PlatformRole;
}>;

export class PlatformAuthenticationRequiredError extends Error {
  readonly name = 'PlatformAuthenticationRequiredError';
  readonly code = 'AUTHENTICATION_REQUIRED';
  readonly status = 401;
}

export class PlatformPermissionRequiredError extends Error {
  readonly name = 'PlatformPermissionRequiredError';
  readonly code = 'PLATFORM_PERMISSION_REQUIRED';
  readonly status = 403;
  readonly details: Readonly<{ requiredRoles: readonly PlatformRole[] }>;
  constructor(requiredRoles: readonly PlatformRole[]) {
    super('The current user does not have platform administration privileges.');
    this.details = Object.freeze({ requiredRoles });
  }
}

export function isPlatformContextError(
  error: unknown,
): error is PlatformAuthenticationRequiredError | PlatformPermissionRequiredError {
  return error instanceof PlatformAuthenticationRequiredError
    || error instanceof PlatformPermissionRequiredError;
}

const PLATFORM_ROLES_WITH_FULL_ACCESS: ReadonlySet<PlatformRole> = new Set<PlatformRole>(['PLATFORM_ADMIN']);
const PLATFORM_ROLES_WITH_SUPPORT_ACCESS: ReadonlySet<PlatformRole> = new Set<PlatformRole>(['PLATFORM_ADMIN', 'SUPPORT_ADMIN']);

export function isPlatformAdmin(role: PlatformRole): boolean {
  return PLATFORM_ROLES_WITH_FULL_ACCESS.has(role);
}

export function isPlatformOperator(role: PlatformRole): boolean {
  return PLATFORM_ROLES_WITH_SUPPORT_ACCESS.has(role);
}

export async function getPlatformContext(
  request: AuthenticatedRequest,
  _requestId = '',
): Promise<PlatformContext | null> {
  const sessionUser = request.user;
  if (!sessionUser?.userId) return null;
  const user = await prisma.user.findFirst({
    where: { id: sessionUser.userId, isActive: true, platformRole: { not: null } },
    select: { id: true, email: true, platformRole: true },
  });
  if (!user?.platformRole) return null;
  return {
    authorizationScope: 'platform',
    userId: user.id,
    email: user.email,
    role: user.platformRole,
  };
}

export async function requirePlatformContext(
  request: AuthenticatedRequest,
  requestId: string,
  allowedRoles: readonly PlatformRole[] = ['PLATFORM_ADMIN'],
): Promise<PlatformContext> {
  const context = await getPlatformContext(request, requestId);
  if (!context) {
    await recordSecurityEventBestEffort({
      eventType: 'platform.context.denied',
      outcome: 'DENIED',
      severity: 'WARNING',
      reasonCode: 'PLATFORM_CONTEXT_UNRESOLVED',
      module: 'platform',
      entityType: 'PlatformContext',
      action: 'RESOLVE',
      requestId,
      userId: request.user?.userId,
    });
    throw new PlatformAuthenticationRequiredError();
  }
  if (!allowedRoles.includes(context.role)) {
    await recordSecurityEventBestEffort({
      userId: context.userId,
      eventType: 'platform.context.denied',
      outcome: 'DENIED',
      severity: 'WARNING',
      reasonCode: 'PLATFORM_ROLE_NOT_ALLOWED',
      module: 'platform',
      entityType: 'PlatformContext',
      action: 'RESOLVE',
      requestId,
      attributes: { currentRole: context.role, requiredRoles: allowedRoles },
    });
    throw new PlatformPermissionRequiredError(allowedRoles);
  }
  return context;
}
