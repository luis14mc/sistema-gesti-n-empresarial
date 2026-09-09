import type { AuthenticatedRequest } from '@/lib/middleware';
import { requireOrganizationContext, type OrganizationContext } from '@/modules/organizations/application/context';
import { apiFailure } from '@/platform/api/response';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { requireOrganizationPermission } from '@/platform/security/authorization/effective-permissions';
import type { Permission } from '@/platform/security/authorization/permissions';

export async function authorizeOrganization(
  req: AuthenticatedRequest,
  requestId: string,
  permission: Permission,
): Promise<OrganizationContext> {
  const context = await requireOrganizationContext(req, requestId);
  await requireOrganizationPermission(context.userId, context.organizationId, context.role, permission);
  return context;
}

export function authorizationFailure(error: unknown, requestId: string) {
  if (!(error instanceof PermissionDeniedError)) return null;
  return apiFailure(error.code, error.message, {
    requestId,
    status: 403,
    details: error.details,
    stage: 'AUTHORIZE_ORGANIZATION',
  });
}
