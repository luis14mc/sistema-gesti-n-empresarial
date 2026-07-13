import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { comparePassword, hashPassword } from '@/lib/auth';
import { createAuditRecord } from '@/lib/audit';

// ============================================
// POST /api/auth/password
// Body: { currentPassword: string, newPassword: string }
// Cambia la contraseña del usuario autenticado.
// Requiere contraseña actual válida. Política: mínimo 8 caracteres.
// ============================================

const MIN_LENGTH = 8;

async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const currentPassword = (body.currentPassword ?? '').toString();
    const newPassword     = (body.newPassword ?? '').toString();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Contraseña actual y nueva son requeridas' },
        { status: 400 }
      );
    }

    if (newPassword.length < MIN_LENGTH) {
      return NextResponse.json(
        { error: `La nueva contraseña debe tener al menos ${MIN_LENGTH} caracteres` },
        { status: 400 }
      );
    }

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
    await prisma.user.update({
      where: { id: user.id },
      data: { password: newHashed },
    });

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
