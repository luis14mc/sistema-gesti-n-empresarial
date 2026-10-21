import type { AuthenticatedRequest } from '@/lib/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/modules/users/infrastructure/user-repository';
import { createAuditRecord } from '@/lib/audit';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';
import { ORGANIZATION_ROLES, type OrganizationRole } from '@/platform/security/authorization/permissions';
import {
  bumpOrganizationRoleAccessVersion,
  loadOrganizationRolePermissionMapUncached,
} from '@/platform/security/authorization/role-permission-service';
import { officialPermissionsForRole } from '@/platform/security/authorization/official-role-permissions';
import { buildRoleModuleMatrix } from '@/platform/security/role-permission-matrix';

const roleParamSchema = z.enum(
  ORGANIZATION_ROLES as unknown as [OrganizationRole, ...OrganizationRole[]],
);

export async function postRoleReset(req: AuthenticatedRequest, ctx: { params: Promise<{ role: string }> }) {
  const requestId = crypto.randomUUID();
  const { role: roleRaw } = await ctx.params;
  const parsedRole = roleParamSchema.safeParse(roleRaw);
  if (!parsedRole.success) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }
  const role = parsedRole.data;

  try {
    const context = await authorizeOrganization(req, requestId, 'roles.manage');
    const organizationId = context.organizationId;

    const beforeRows = await prisma.rolePermission.findMany({
      where: { organizationId, role },
      select: { permission: true },
    });
    const before = beforeRows.map((row) => row.permission).sort();
    const official = [...officialPermissionsForRole(role)].sort();

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { organizationId, role } });
      await tx.rolePermission.createMany({
        data: official.map((permission) => ({ organizationId, role, permission })),
        skipDuplicates: true,
      });
      await bumpOrganizationRoleAccessVersion(organizationId, tx);
    });

    await createAuditRecord({
      title: 'Restablecer permisos oficiales del rol',
      description: `Rol ${role} restaurado a plantilla oficial`,
      module: 'USUARIOS',
      category: 'UPDATE',
      userId: context.userId,
      entityId: role,
      organizationId,
      previousData: { role, permissions: before },
      newData: { role, permissions: official, source: 'official_template' },
    });

    const map = await loadOrganizationRolePermissionMapUncached(organizationId);
    return NextResponse.json({
      ok: true,
      modified: false,
      moduleAccess: buildRoleModuleMatrix(role, map),
    });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    console.error('POST role reset', error);
    return NextResponse.json({ error: 'Error al restablecer rol' }, { status: 500 });
  }
}

