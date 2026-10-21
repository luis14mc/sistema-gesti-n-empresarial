import type { AuthenticatedRequest } from '@/lib/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/modules/users/infrastructure/user-repository';
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

export async function getRolePermissions(req: AuthenticatedRequest, ctx: { params: Promise<{ role: string }> }) {
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

export async function putRolePermissions(req: AuthenticatedRequest, ctx: { params: Promise<{ role: string }> }) {
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

    if (desiredSet.size === 0) {
      return NextResponse.json(
        {
          error:
            'Un rol debe tener al menos un permiso. Para dejar de usarlo, desactive "Disponible para asignar" en Ajustes.',
        },
        { status: 400 },
      );
    }

    // "Before" = what the role effectively had (DB rows, or the official template
    // when the role was never materialized in role_permissions).
    const roleMap = await loadOrganizationRolePermissionMap(organizationId);
    const currentSet = effectivePermissionSetForRole(role, roleMap);
    const before = [...currentSet].sort();
    const nextSet = desiredSet;

    const toAdd = [...nextSet].filter((permission) => !currentSet.has(permission));
    const toRemove = [...currentSet].filter((permission) => !nextSet.has(permission));

    // Persist the COMPLETE desired set for this role (replace, not diff).
    // A diff against the official fallback stored only additions: removals were
    // lost (role had no rows → fell back to the official template) and, after an
    // addition, the role kept ONLY the added permissions.
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { organizationId, role } });
      await tx.rolePermission.createMany({
        data: [...nextSet].map((permission) => ({ organizationId, role, permission })),
        skipDuplicates: true,
      });
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

