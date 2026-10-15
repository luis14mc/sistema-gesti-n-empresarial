import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';
import { ORGANIZATION_ROLES, type OrganizationRole } from '@/platform/security/authorization/permissions';
import {
  ensureRoleSettingsForOrganization,
  getRoleSettingRow,
} from '@/platform/security/authorization/role-catalog-service';

const roleParamSchema = z.enum(
  ORGANIZATION_ROLES as unknown as [OrganizationRole, ...OrganizationRole[]],
);

const putSchema = z.object({
  displayName: z.string().trim().min(1, 'Nombre visible requerido').max(80),
  description: z.string().trim().max(500).nullable().optional(),
  assignable: z.boolean(),
  confirmRetainMembers: z.boolean().optional(),
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
    const role = parsedRole.data;
    const memberCount = await prisma.organizationMembership.count({
      where: { organizationId: context.organizationId, role, status: 'ACTIVE' },
    });
    const settings = await getRoleSettingRow(context.organizationId, role);
    return NextResponse.json({
      role,
      displayName: settings.displayName,
      description: settings.description,
      assignable: settings.assignable,
      memberCount,
      adminLocked: role === 'ADMIN',
    });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    console.error('GET role settings', error);
    return NextResponse.json({ error: 'Error al cargar configuración del rol' }, { status: 500 });
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Payload inválido' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  try {
    const context = await authorizeOrganization(req, requestId, 'roles.manage');
    const organizationId = context.organizationId;
    await ensureRoleSettingsForOrganization(organizationId);

    const memberCount = await prisma.organizationMembership.count({
      where: { organizationId, role, status: 'ACTIVE' },
    });

    const assignable = role === 'ADMIN' ? true : body.assignable;
    if (role === 'ADMIN' && body.assignable === false) {
      return NextResponse.json(
        { error: 'El rol Super Admin siempre está disponible para asignación' },
        { status: 400 },
      );
    }

    if (!assignable && memberCount > 0 && !body.confirmRetainMembers) {
      return NextResponse.json(
        {
          error: 'CONFIRM_RETAIN_MEMBERS',
          memberCount,
          message: `${memberCount} usuario(s) conservan este rol, pero no se podrá asignar a nuevos.`,
        },
        { status: 409 },
      );
    }

    const before = await prisma.roleSetting.findUnique({
      where: { organizationId_role: { organizationId, role } },
    });

    const updated = await prisma.roleSetting.update({
      where: { organizationId_role: { organizationId, role } },
      data: {
        displayName: body.displayName,
        description: body.description ?? null,
        assignable,
        updatedById: context.userId,
      },
    });

    await createAuditRecord({
      title: 'Configuración de rol',
      description: `Ajustes de catálogo para rol ${role}`,
      module: 'USUARIOS',
      category: 'UPDATE',
      userId: context.userId,
      entityId: role,
      organizationId,
      previousData: before
        ? {
            displayName: before.displayName,
            description: before.description,
            assignable: before.assignable,
          }
        : null,
      newData: {
        displayName: updated.displayName,
        description: updated.description,
        assignable: updated.assignable,
      },
    });

    return NextResponse.json({
      role,
      displayName: updated.displayName,
      description: updated.description,
      assignable: role === 'ADMIN' ? true : updated.assignable,
      memberCount,
      adminLocked: role === 'ADMIN',
    });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    console.error('PUT role settings', error);
    return NextResponse.json({ error: 'Error al guardar configuración del rol' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const PUT = withAuth(putHandler);
