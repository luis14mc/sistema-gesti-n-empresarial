import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';
import { ORGANIZATION_ROLES, type OrganizationRole } from '@/platform/security/authorization/permissions';
import {
  applyLockedPermissions,
  findMissingLockedPermissions,
} from '@/platform/security/authorization/role-permission-locks';
import {
  bumpOrganizationRoleAccessVersion,
  effectivePermissionSetForRole,
  isRoleMatrixModified,
  loadOrganizationRolePermissionMap,
  loadOrganizationRolePermissionMapUncached,
} from '@/platform/security/authorization/role-permission-service';
import { buildRoleModuleMatrix, permissionsFromRoleModuleRows } from '@/platform/security/role-permission-matrix';
import { MODULE_IDS, normalizeModuleRow, type ModuleId } from '@/platform/security/modules';
import { normalizeDesiredRow } from '@/platform/security/module-effective';

const roleParamSchema = z.enum(
  ORGANIZATION_ROLES as unknown as [OrganizationRole, ...OrganizationRole[]],
);

const rowSchema = z.object({
  module: z.enum(MODULE_IDS as [ModuleId, ...ModuleId[]]),
  canRead: z.boolean(),
  canCreate: z.boolean(),
  canUpdate: z.boolean(),
  canDelete: z.boolean(),
  extras: z.array(z.string()).default([]),
});

const putSchema = z.object({
  rows: z.array(rowSchema),
});

async function getHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ role: string }> }) {
  const requestId = crypto.randomUUID();
  const { role: roleRaw } = await ctx.params;
  const parsedRole = roleParamSchema.safeParse(roleRaw);
  if (!parsedRole.success) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }
  try {
    const context = await authorizeOrganization(req, requestId, 'roles.manage');
    const roleMap = await loadOrganizationRolePermissionMap(context.organizationId);
    const role = parsedRole.data;
    const memberCount = await prisma.organizationMembership.count({
      where: { organizationId: context.organizationId, role, status: 'ACTIVE' },
    });

    return NextResponse.json({
      role,
      memberCount,
      modified: isRoleMatrixModified(role, roleMap),
      moduleAccess: buildRoleModuleMatrix(role, roleMap),
    });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    console.error('GET role permissions', error);
    return NextResponse.json({ error: 'Error al cargar permisos del rol' }, { status: 500 });
  }
}

async function putHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ role: string }> }) {
  const requestId = crypto.randomUUID();
  const { role: roleRaw } = await ctx.params;
  const parsedRole = roleParamSchema.safeParse(roleRaw);
  if (!parsedRole.success) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }
  const role = parsedRole.data;

  let body: z.infer<typeof putSchema>;
  try {
    body = putSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  try {
    const context = await authorizeOrganization(req, requestId, 'roles.manage');
    const organizationId = context.organizationId;

    const normalizedRows = body.rows.map((row) => normalizeDesiredRow(normalizeModuleRow(row)));
    const desiredPermissions = permissionsFromRoleModuleRows(normalizedRows);
    const missingLocks = findMissingLockedPermissions(role, desiredPermissions);
    if (missingLocks.length > 0) {
      return NextResponse.json(
        {
          error: 'No se pueden quitar permisos obligatorios del rol',
          missing: missingLocks,
        },
        { status: 400 },
      );
    }
    const desiredSet = new Set(desiredPermissions);
    applyLockedPermissions(role, desiredSet);

    const beforeRows = await prisma.rolePermission.findMany({
      where: { organizationId, role },
      select: { permission: true },
    });
    const before = beforeRows.map((row) => row.permission).sort();

    const roleMap = await loadOrganizationRolePermissionMap(organizationId);
    const currentSet = effectivePermissionSetForRole(role, roleMap);
    const nextSet = desiredSet;

    const toAdd = [...nextSet].filter((permission) => !currentSet.has(permission));
    const toRemove = [...currentSet].filter((permission) => !nextSet.has(permission));

    await prisma.$transaction(async (tx) => {
      if (toRemove.length) {
        await tx.rolePermission.deleteMany({
          where: {
            organizationId,
            role,
            permission: { in: toRemove },
          },
        });
      }
      if (toAdd.length) {
        await tx.rolePermission.createMany({
          data: toAdd.map((permission) => ({ organizationId, role, permission })),
          skipDuplicates: true,
        });
      }
      await bumpOrganizationRoleAccessVersion(organizationId, tx);
    });

    const after = [...nextSet].sort();

    await createAuditRecord({
      title: 'Matriz de permisos por rol',
      description: `Permisos actualizados para rol ${role}`,
      module: 'USUARIOS',
      category: 'UPDATE',
      userId: context.userId,
      entityId: role,
      organizationId,
      previousData: { role, permissions: before },
      newData: { role, permissions: after, added: toAdd, removed: toRemove },
    });

    const refreshedMap = await loadOrganizationRolePermissionMapUncached(organizationId);
    return NextResponse.json({
      ok: true,
      modified: isRoleMatrixModified(role, refreshedMap),
      moduleAccess: buildRoleModuleMatrix(role, refreshedMap),
    });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    console.error('PUT role permissions', error);
    return NextResponse.json({ error: 'Error al guardar permisos del rol' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const PUT = withAuth(putHandler);
