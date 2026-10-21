import type { AuthenticatedRequest } from '@/lib/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/modules/users/infrastructure/user-repository';
import { createAuditRecord } from '@/lib/audit';
import { canonicalOrganizationId } from '@/platform/security/organization-scope';
import {
  buildEffectiveModuleMatrix,
  normalizeDesiredRow,
  overridesFromDesiredMatrix,
} from '@/platform/security/module-effective';
import { MODULE_CATALOG, MODULE_IDS, type ModuleId } from '@/platform/security/modules';
import { requireOrganizationPermission } from '@/platform/security/authorization/effective-permissions';
import type { PermissionOverride } from '@/platform/security/authorization/permissions';
import {
  createRolePermissionCheck,
  loadOrganizationRolePermissionMap,
} from '@/platform/security/authorization/role-permission-service';
import { findDenyOverridesOnLockedPermissions } from '@/platform/security/authorization/role-permission-locks';

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

export async function getUserPermissionOverrides(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: targetUserId } = await ctx.params;
  const organizationId = canonicalOrganizationId();
  const actorId = req.user!.userId;

  const actorMembership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: actorId } },
    select: { role: true },
  });
  if (!actorMembership) return NextResponse.json({ error: 'Sin membresía' }, { status: 403 });
  await requireOrganizationPermission(actorId, organizationId, actorMembership.role, 'users.read');

  const targetMembership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
    select: { role: true },
  });
  if (!targetMembership) return NextResponse.json({ error: 'Usuario sin membresía' }, { status: 404 });

  const [overrides, roleMap] = await Promise.all([
    prisma.userPermissionOverride.findMany({
      where: { organizationId, userId: targetUserId },
      select: { permission: true, effect: true },
    }),
    loadOrganizationRolePermissionMap(organizationId),
  ]);
  const roleHas = createRolePermissionCheck(targetMembership.role, roleMap);
  const typedOverrides = overrides as PermissionOverride[];

  return NextResponse.json({
    role: targetMembership.role,
    overrides: typedOverrides,
    roleModuleAccess: buildEffectiveModuleMatrix(targetMembership.role, [], roleHas),
    moduleAccess: buildEffectiveModuleMatrix(targetMembership.role, typedOverrides, roleHas),
  });
}

export async function putUserPermissionOverrides(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: targetUserId } = await ctx.params;
  const organizationId = canonicalOrganizationId();
  const actorId = req.user!.userId;

  const actorMembership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: actorId } },
    select: { role: true },
  });
  if (!actorMembership) return NextResponse.json({ error: 'Sin membresía' }, { status: 403 });
  await requireOrganizationPermission(actorId, organizationId, actorMembership.role, 'users.update');

  const parsed = putSchema.parse(await req.json());

  const targetMembership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
    select: { role: true },
  });
  if (!targetMembership) return NextResponse.json({ error: 'Usuario sin membresía' }, { status: 404 });

  const beforeOverrides = await prisma.userPermissionOverride.findMany({
    where: { organizationId, userId: targetUserId },
    select: { permission: true, effect: true },
  });

  const roleMap = await loadOrganizationRolePermissionMap(organizationId);
  const roleHas = createRolePermissionCheck(targetMembership.role, roleMap);

  let nextOverrides: PermissionOverride[] = beforeOverrides as PermissionOverride[];
  for (const row of parsed.rows) {
    const def = MODULE_CATALOG[row.module];
    const allowedExtras = new Set(def.specials.map((s) => s.id));
    const normalized = normalizeDesiredRow({
      ...row,
      extras: row.extras.filter((e) => allowedExtras.has(e as never)),
    });
    nextOverrides = overridesFromDesiredMatrix(targetMembership.role, nextOverrides, normalized, roleHas);
  }

  const illegalDenies = findDenyOverridesOnLockedPermissions(targetMembership.role, nextOverrides);
  if (illegalDenies.length > 0) {
    return NextResponse.json(
      {
        error: 'No se pueden denegar permisos obligatorios del rol',
        permissions: illegalDenies,
      },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.userPermissionOverride.deleteMany({ where: { organizationId, userId: targetUserId } });
    if (nextOverrides.length) {
      await tx.userPermissionOverride.createMany({
        data: nextOverrides.map((o) => ({
          organizationId,
          userId: targetUserId,
          permission: o.permission,
          effect: o.effect,
          createdById: actorId,
        })),
      });
    }
    await tx.organizationMembership.update({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
      data: { accessVersion: { increment: 1 } },
    });
  });

  await createAuditRecord({
    title: 'Excepciones de permisos por usuario',
    description: `Overrides actualizados para ${targetUserId}`,
    module: 'USUARIOS',
    category: 'UPDATE',
    userId: actorId,
    entityId: targetUserId,
    previousData: { overrides: beforeOverrides },
    newData: { overrides: nextOverrides },
  });

  return NextResponse.json({
    ok: true,
    overrides: nextOverrides,
    moduleAccess: buildEffectiveModuleMatrix(targetMembership.role, nextOverrides, roleHas),
  });
}

export async function deleteUserPermissionOverrides(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: targetUserId } = await ctx.params;
  const organizationId = canonicalOrganizationId();
  const actorId = req.user!.userId;

  const actorMembership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: actorId } },
    select: { role: true },
  });
  if (!actorMembership) return NextResponse.json({ error: 'Sin membresía' }, { status: 403 });
  await requireOrganizationPermission(actorId, organizationId, actorMembership.role, 'users.update');

  const beforeOverrides = await prisma.userPermissionOverride.findMany({
    where: { organizationId, userId: targetUserId },
  });

  await prisma.$transaction([
    prisma.userPermissionOverride.deleteMany({ where: { organizationId, userId: targetUserId } }),
    prisma.organizationMembership.update({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
      data: { accessVersion: { increment: 1 } },
    }),
  ]);

  await createAuditRecord({
    title: 'Excepciones de permisos eliminadas',
    description: `Se restableció el rol base para ${targetUserId}`,
    module: 'USUARIOS',
    category: 'UPDATE',
    userId: actorId,
    entityId: targetUserId,
    previousData: { overrides: beforeOverrides },
    newData: { overrides: [] },
  });

  return NextResponse.json({ ok: true });
}

