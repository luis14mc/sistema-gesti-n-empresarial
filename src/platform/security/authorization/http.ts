import type { AuthenticatedRequest } from '@/lib/middleware';
import { requireOrganizationContext, type OrganizationContext } from '@/modules/organizations/application/context';
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
