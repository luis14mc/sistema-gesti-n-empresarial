import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        employeeNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        departmentId: true,
        positionId: true,
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    return NextResponse.json(
      { error: 'Error al obtener perfil' },
      { status: 500 }
    );
  }
}

async function patchHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, phone, email } = body;

    // Validar email si se quiere cambiar
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
      }
      // Verificar unicidad
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: req.user!.userId } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Email ya en uso' }, { status: 409 });
      }
    }

    if (firstName !== undefined && typeof firstName !== 'string') {
      return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 });
    }
    if (lastName !== undefined && typeof lastName !== 'string') {
      return NextResponse.json({ error: 'Apellido inválido' }, { status: 400 });
    }

    const previous = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { firstName: true, lastName: true, phone: true, email: true },
    });

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName  !== undefined && { lastName }),
        ...(phone     !== undefined && { phone }),
        ...(email     !== undefined && { email }),
      },
      select: {
        id: true, employeeNumber: true, email: true,
        firstName: true, lastName: true, phone: true,
        role: true, isActive: true, createdAt: true,
      },
    });

    if (previous) {
      await createAuditRecord({
        title: 'Actualización de perfil propio',
        description: `${user.firstName} ${user.lastName} actualizó su perfil`,
        module: 'USUARIOS',
        category: 'UPDATE',
        userId: req.user!.userId,
        entityId: user.id,
        previousData: {
          email: previous.email,
          phone: previous.phone,
        },
        newData: {
          email: user.email,
          phone: user.phone,
        },
      });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    return NextResponse.json(
      { error: 'Error al actualizar perfil' },
      { status: 500 }
    );
  }
}

export const GET   = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
