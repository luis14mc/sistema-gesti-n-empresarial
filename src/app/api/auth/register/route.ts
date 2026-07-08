import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { registerSchema } from '@/lib/zod-schemas';
import { createAuditRecord } from '@/lib/audit';

async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, password, firstName, lastName, employeeNumber } = parsed.data;

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { employeeNumber }] },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'El email o número de empleado ya está registrado' },
        { status: 409 }
      );
    }

    // Hash de la contraseña
    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        employeeNumber,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'USER',
      },
    });

    // Retornar usuario sin contraseña
    const { password: _, ...userWithoutPassword } = user;

    await createAuditRecord({
      title: 'Registro de usuario',
      description: `Se creó el usuario ${firstName} ${lastName} (${email})`,
      module: 'USUARIOS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: user.id,
      newData: { email, employeeNumber, role: 'USER' },
    });

    return NextResponse.json({
      user: userWithoutPassword,
    }, { status: 201 });
  } catch (error) {
    console.error('Error en registro:', error);
    return NextResponse.json(
      { error: 'Error al registrar usuario' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler, ['ADMIN', 'RRHH']);
