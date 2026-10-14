import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import {
  isOrganizationContextError,
  requireOrganizationContext,
} from '@/modules/organizations/application/context';
import {
  buildEffectiveModuleMatrix,
  normalizeDesiredRow,
  overridesFromDesiredMatrix,
} from '@/platform/security/module-effective';
import { MODULE_CATALOG, MODULE_IDS, type ModuleId } from '@/platform/security/modules';
import { requireOrganizationPermission } from '@/platform/security/authorization/effective-permissions';
import { PermissionDeniedError } from '@/platform/domain/errors';
import type { PermissionOverride } from '@/platform/security/authorization/permissions';

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

function organizationContextFailure(error: unknown) {
  if (isOrganizationContextError(error)) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
  }
  return null;
}

async function getHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: targetUserId } = await ctx.params;
    const org = await requireOrganizationContext(req);
    const actorId = org.userId;

    await requireOrganizationPermission(actorId, org.organizationId, org.role, 'users.read');

    const targetMembership = await prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: org.organizationId, userId: targetUserId } },
      select: { role: true },
    });
    if (!targetMembership) return NextResponse.json({ error: 'Usuario sin membresía' }, { status: 404 });

    const overrides = await prisma.userPermissionOverride.findMany({
      where: { organizationId: org.organizationId, userId: targetUserId },
      select: { permission: true, effect: true },
    });

    return NextResponse.json({
      role: targetMembership.role,
      overrides,
      moduleAccess: buildEffectiveModuleMatrix(
        targetMembership.role,
        overrides as PermissionOverride[],
      ),
    });
  } catch (error) {
    const response = organizationContextFailure(error);
    if (response) return response;
    throw error;
  }
}

async function putHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: targetUserId } = await ctx.params;
    const org = await requireOrganizationContext(req);
    const actorId = org.userId;

    await requireOrganizationPermission(actorId, org.organizationId, org.role, 'users.update');

    const parsed = putSchema.parse(await req.json());

    if (targetUserId === actorId) {
      const usersRow = parsed.rows.find((r) => r.module === 'users');
      if (!usersRow?.canRead) {
        return NextResponse.json({ error: 'No puede quitarse el acceso a Usuarios' }, { status: 400 });
      }
    }

    const targetMembership = await prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: org.organizationId, userId: targetUserId } },
      select: { role: true },
    });
    if (!targetMembership) return NextResponse.json({ error: 'Usuario sin membresía' }, { status: 404 });

    const beforeOverrides = await prisma.userPermissionOverride.findMany({
      where: { organizationId: org.organizationId, userId: targetUserId },
      select: { permission: true, effect: true },
    });

    let nextOverrides: PermissionOverride[] = beforeOverrides as PermissionOverride[];
    for (const row of parsed.rows) {
      const def = MODULE_CATALOG[row.module];
      const allowedExtras = new Set(def.specials.map((s) => s.id));
      const normalized = normalizeDesiredRow({
        ...row,
        extras: row.extras.filter((e) => allowedExtras.has(e as never)),
      });
      nextOverrides = overridesFromDesiredMatrix(targetMembership.role, nextOverrides, normalized);
    }

    await prisma.$transaction(async (tx) => {
      await tx.userPermissionOverride.deleteMany({
        where: { organizationId: org.organizationId, userId: targetUserId },
      });
      if (nextOverrides.length) {
        await tx.userPermissionOverride.createMany({
          data: nextOverrides.map((o) => ({
            organizationId: org.organizationId,
            userId: targetUserId,
            permission: o.permission,
            effect: o.effect,
            createdById: actorId,
          })),
        });
      }
      await tx.organizationMembership.update({
        where: { organizationId_userId: { organizationId: org.organizationId, userId: targetUserId } },
        data: { accessVersion: { increment: 1 } },
      });
    });

    await createAuditRecord({
      title: 'Excepciones de permisos por usuario',
      description: `Overrides actualizados para ${targetUserId}`,
      module: 'USUARIOS',
      category: 'UPDATE',
      userId: actorId,
      organizationId: org.organizationId,
      entityId: targetUserId,
      previousData: { overrides: beforeOverrides },
      newData: { overrides: nextOverrides },
    });

    return NextResponse.json({
      ok: true,
      overrides: nextOverrides,
      moduleAccess: buildEffectiveModuleMatrix(targetMembership.role, nextOverrides),
    });
  } catch (error) {
    const response = organizationContextFailure(error);
    if (response) return response;
    throw error;
  }
}

async function deleteHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: targetUserId } = await ctx.params;
    const org = await requireOrganizationContext(req);
    const actorId = org.userId;

    await requireOrganizationPermission(actorId, org.organizationId, org.role, 'users.update');

    const beforeOverrides = await prisma.userPermissionOverride.findMany({
      where: { organizationId: org.organizationId, userId: targetUserId },
    });

    await prisma.$transaction([
      prisma.userPermissionOverride.deleteMany({
        where: { organizationId: org.organizationId, userId: targetUserId },
      }),
      prisma.organizationMembership.update({
        where: { organizationId_userId: { organizationId: org.organizationId, userId: targetUserId } },
        data: { accessVersion: { increment: 1 } },
      }),
    ]);

    await createAuditRecord({
      title: 'Excepciones de permisos eliminadas',
      description: `Se restableció el rol base para ${targetUserId}`,
      module: 'USUARIOS',
      category: 'UPDATE',
      userId: actorId,
      organizationId: org.organizationId,
      entityId: targetUserId,
      previousData: { overrides: beforeOverrides },
      newData: { overrides: [] },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = organizationContextFailure(error);
    if (response) return response;
    throw error;
  }
}

export const GET = withAuth(getHandler);
export const PUT = withAuth(putHandler);
export const DELETE = withAuth(deleteHandler);
