import type { OrganizationContext } from '@/modules/organizations/application/context';
import { getEffectiveOrganizationPermissions } from '@/platform/security/authorization/effective-permissions';
import {
  ORGANIZATION_PERMISSIONS,
  type Permission,
} from '@/platform/security/authorization/permissions';

export async function loadEffectivePermissions(
  context: Pick<OrganizationContext, 'userId' | 'organizationId' | 'role'>,
): Promise<ReadonlySet<Permission>> {
  return getEffectiveOrganizationPermissions(
    context.userId,
    context.organizationId,
    context.role,
    ORGANIZATION_PERMISSIONS,
  );
}
