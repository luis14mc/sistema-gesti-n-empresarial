import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { comparePassword, hashPassword } from '@/lib/auth';
import { createAuditRecord } from '@/lib/audit';
import { passwordPolicySchema } from '@/platform/security/password-policy';
import { canonicalOrganizationId } from '@/platform/security/organization-scope';
import { z } from 'zod';

// ============================================
// POST /api/auth/password
// Body: { currentPassword: string, newPassword: string }
// Cambia la contraseña del usuario autenticado.
// ============================================

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: passwordPolicySchema,
});

async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = changePasswordSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json(
        { error: body.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 },
      );
    }
    const { currentPassword, newPassword } = body.data;

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe ser diferente a la actual' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, password: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const currentOk = await comparePassword(currentPassword, user.password);
    if (!currentOk) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    const newHashed = await hashPassword(newPassword);
    const now = new Date();
    const organizationId = canonicalOrganizationId();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: newHashed,
          passwordChangedAt: now,
          mustChangePassword: false,
        },
      }),
      prisma.organizationMembership.updateMany({
        where: { userId: user.id, organizationId },
        data: { accessVersion: { increment: 1 } },
      }),
    ]);

    await createAuditRecord({
      title: 'Cambio de contraseña',
      description: `El usuario ${user.email} cambió su contraseña`,
      module: 'USUARIOS',
      category: 'UPDATE',
      userId: user.id,
      entityId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: 'Error al cambiar contraseña' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);
