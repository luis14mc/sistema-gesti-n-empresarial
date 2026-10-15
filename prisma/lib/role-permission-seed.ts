import type { PrismaClient } from '@prisma/client';
import { flattenOfficialRolePermissions } from '@/platform/security/authorization/official-role-permissions';

export const DEFAULT_ORG_ID_FOR_ROLE_SEED = 'org_cni_default';

export async function seedOfficialRolePermissions(
  prisma: PrismaClient,
  organizationId: string = DEFAULT_ORG_ID_FOR_ROLE_SEED,
): Promise<number> {
  const rows = flattenOfficialRolePermissions();
  let created = 0;
  for (const { role, permission } of rows) {
    await prisma.rolePermission.upsert({
      where: {
        organizationId_role_permission: { organizationId, role, permission },
      },
      create: { organizationId, role, permission },
      update: {},
    });
    created += 1;
  }
  return created;
}
