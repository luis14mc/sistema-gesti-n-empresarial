import type { OrganizationRole } from '@prisma/client';
import type { Permission } from '@/platform/security/authorization/permissions';
import { ORGANIZATION_PERMISSIONS } from '@/platform/security/authorization/organization-permission-catalog';
import { canForOrganization } from '@/platform/security/authorization/effective-permissions';
import { PermissionDeniedError } from '@/platform/domain/errors';

const DELETE_PERMISSION = 'employees.delete' as Permission;
const catalogHasDeletePermission = (ORGANIZATION_PERMISSIONS as readonly string[]).includes(DELETE_PERMISSION);

export async function assertCanDeleteEmployee(
  userId: string,
  organizationId: string,
  role: OrganizationRole,
): Promise<void> {
  if (catalogHasDeletePermission) {
    const allowed = await canForOrganization(userId, organizationId, role, DELETE_PERMISSION);
    if (allowed) return;
  } else if (role === 'ADMIN' || role === 'OWNER') {
    return;
  }
  throw new PermissionDeniedError('No tiene permiso para eliminar empleados.');
}
