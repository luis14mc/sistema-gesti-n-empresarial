import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/platform/api/with-auth';
import { registerSchema } from '@/lib/zod-schemas';
import { registerUserFromApi } from '@/modules/auth/application/register';

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

    const result = await registerUserFromApi(parsed.data, req.user!.userId);

    if (result.kind === 'duplicate') {
      return NextResponse.json(
        { error: 'El email o número de empleado ya está registrado' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      user: result.user,
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
