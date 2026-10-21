import type { AuthenticatedRequest } from '@/lib/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/modules/users/infrastructure/user-repository';
import { hashPassword } from '@/lib/auth';
import { createAuditRecord } from '@/lib/audit';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { passwordPolicySchema } from '@/platform/security/password-policy';
const adminPasswordResetSchema = z.object({
  newPassword: passwordPolicySchema,
  mustChangePassword: z.boolean().default(true),
});

export async function postAdminPasswordReset(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { id: targetUserId } = await ctx.params;
    const actor = await authorizeOrganization(req, requestId, 'users.update');
    const organizationId = actor.organizationId;

    if (targetUserId === req.user!.userId) {
      return NextResponse.json({ error: 'Use el cambio de contraseña propio' }, { status: 403 });
    }

    const body = adminPasswordResetSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ error: body.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    }

    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: targetUserId, organizationId, status: 'ACTIVE' },
      select: { id: true, role: true, user: { select: { email: true, firstName: true, lastName: true } } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (membership.role === 'OWNER' && actor.role !== 'OWNER') {
      return NextResponse.json({ error: 'No puede restablecer la contraseña de un propietario' }, { status: 403 });
    }

    const hashed = await hashPassword(body.data.newPassword);
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: {
          password: hashed,
          passwordChangedAt: now,
          mustChangePassword: body.data.mustChangePassword,
        },
      }),
      prisma.organizationMembership.update({
        where: { id: membership.id },
        data: { accessVersion: { increment: 1 } },
      }),
    ]);

    await createAuditRecord({
      title: 'PASSWORD_RESET_BY_ADMIN',
      description: `Restablecimiento de contraseña para ${membership.user.firstName} ${membership.user.lastName} (${membership.user.email})`,
      module: 'USUARIOS',
      category: 'UPDATE',
      userId: req.user!.userId,
      entityId: targetUserId,
      organizationId,
      newData: {
        targetUserId,
        mustChangePassword: body.data.mustChangePassword,
        actorUserId: req.user!.userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin password reset failed:', error);
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (isOrganizationContextError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'No se pudo restablecer la contraseña' }, { status: 500 });
  }
}

