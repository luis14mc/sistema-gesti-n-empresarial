import { generateToken, type TokenPayload } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildEffectiveModuleMatrix,
  moduleIdsWithRead,
  organizationRoleForSessionRole,
} from '@/platform/security/module-effective';
import { encodeModulesForJwt } from '@/platform/security/jwt-modules';
import { canonicalOrganizationId } from '@/platform/security/organization-scope';
import {
  createRolePermissionCheck,
  loadOrganizationRolePermissionMap,
} from '@/platform/security/authorization/role-permission-service';

export async function generateSessionToken(input: TokenPayload): Promise<string> {
  const organizationId = canonicalOrganizationId();
  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: input.userId } },
    select: { role: true, accessVersion: true },
  });
  const orgRole = membership?.role ?? organizationRoleForSessionRole(input.role as import('@/lib/session-roles').SessionRole);
  const [overrides, roleMap] = await Promise.all([
    prisma.userPermissionOverride.findMany({
      where: { userId: input.userId, organizationId },
      select: { permission: true, effect: true },
    }),
    loadOrganizationRolePermissionMap(organizationId),
  ]);
  const roleHas = createRolePermissionCheck(orgRole, roleMap);
  const matrix = buildEffectiveModuleMatrix(
    orgRole,
    overrides as import('@/platform/security/authorization/permissions').PermissionOverride[],
    roleHas,
  );

  return generateToken({
    ...input,
    orgId: organizationId,
    accessVersion: membership?.accessVersion ?? 0,
    mod: encodeModulesForJwt(moduleIdsWithRead(matrix)),
  });
}
